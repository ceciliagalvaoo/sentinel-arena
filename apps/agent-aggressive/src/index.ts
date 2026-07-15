/**
 * Standalone process for the aggressive strategy (k=1.5, window=60s). Stays
 * a thin config shim over @sentinel/agent-runtime's shared AgentLoop — never
 * duplicate detection/commit/grading logic between the two agent apps, only
 * the config differs (see apps/agent-conservative/src/index.ts, which is
 * identical except for .env values).
 *
 * Data source is picked at startup, not hardcoded: set REPLAY_FIXTURE_ID to
 * run against a backfilled fixture (packages/recorder-service, via
 * scripts/seed-replay-data.ts) instead of the live TxLINE stream — this is
 * how the agent stays demonstrable after the World Cup ends (architecture
 * doc section 0.2/2.2).
 *
 * This process (only this one, not agent-conservative — the work below is
 * fixture-level, not agent-specific, so one owner is enough) also runs a
 * periodic sweep that auto-backfills `recorded_events` for any fixture that
 * finished live, so production Replay mode has real data without a manual
 * `scripts/seed-replay-data.ts` run after every match. See
 * scheduleReplayBackfillSweep() below for why this can't just happen the
 * instant a match ends.
 */
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import type { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, type PublicKey } from "@solana/web3.js";
import { Pool } from "pg";
import {
  createApiClient,
  createProgram,
  getNetworkConfig,
  resolveNetworkFromEnv,
  startGuestAuth,
  validateFinalScoreOnchain,
} from "@sentinel/txline-client";
import { LiveTxLineSource, ReplayDataSource, type MarketDataSource } from "@sentinel/market-data-source";
import { AgentLoop, SignalStore } from "@sentinel/agent-runtime";
import { resolveDatabaseSsl } from "@sentinel/shared-types";
import { backfillFixture } from "@sentinel/recorder-service";
import type { AxiosInstance } from "axios";

loadDotenv(); // apps/agent-aggressive/.env when run from this package's directory (npm workspace scripts do this)

// Autonomous Operation (architecture doc section 0.2) is eliminatory: this
// process must not die because a public RPC hiccuped with a transient 429 —
// AgentLoop already reports errors via onError, this is the last-resort net
// for anything that slips past it (e.g. a rejection from a library-internal
// timer/websocket callback that isn't part of the awaited promise chain).
process.on("unhandledRejection", (err) => {
  console.error(`[${process.env.AGENT_ID ?? "agent-aggressive"}] unhandled rejection`, err);
});
process.on("uncaughtException", (err) => {
  console.error(`[${process.env.AGENT_ID ?? "agent-aggressive"}] uncaught exception`, err);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

const REQUIRED_ENV_VARS = [
  "NETWORK",
  "SOLANA_RPC_URL",
  "TXLINE_API_ORIGIN",
  "TXLINE_PROGRAM_ID",
  "WALLET_KEYPAIR_PATH",
  "AGENT_ID",
  "SENSITIVITY_MULTIPLIER",
  "WINDOW_SECONDS",
  "WARMUP_READINGS",
  "DATABASE_URL",
] as const;

function assertEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")} — copy .env.example to .env first`);
  }
}

function loadWallet(keypairPath: string): Keypair {
  const resolvedPath = keypairPath.startsWith(".") ? join(REPO_ROOT, keypairPath) : keypairPath;
  const secretKey = Uint8Array.from(JSON.parse(readFileSync(resolvedPath, "utf8")));
  return Keypair.fromSecretKey(secretKey);
}

interface Session {
  jwt: string;
  apiToken: string;
}

function loadSession(agentId: string): Session | null {
  // SESSION_PATH overrides the default repo-relative location -- needed
  // wherever the deploy platform mounts secret files somewhere other than
  // ./secrets (e.g. Render's Secret Files land under /etc/secrets/<name>).
  const sessionPath = process.env.SESSION_PATH ?? join(REPO_ROOT, "secrets", `${agentId}-session.json`);
  if (!existsSync(sessionPath)) return null;
  return JSON.parse(readFileSync(sessionPath, "utf8")) as Session;
}

async function buildSource(
  agentId: string,
  config: ReturnType<typeof getNetworkConfig>,
  pool: Pool,
  session: Session | null,
): Promise<MarketDataSource> {
  const replayFixtureId = process.env.REPLAY_FIXTURE_ID ? Number(process.env.REPLAY_FIXTURE_ID) : undefined;

  if (replayFixtureId !== undefined) {
    const speed = process.env.REPLAY_SPEED_MULTIPLIER ? Number(process.env.REPLAY_SPEED_MULTIPLIER) : 1;
    const maxEvents = process.env.REPLAY_MAX_EVENTS ? Number(process.env.REPLAY_MAX_EVENTS) : undefined;
    const startIndex = process.env.REPLAY_START_INDEX ? Number(process.env.REPLAY_START_INDEX) : undefined;
    console.log(
      `[${agentId}] REPLAY mode — fixture=${replayFixtureId} speed=${speed}x maxEvents=${maxEvents ?? "all"} startIndex=${startIndex ?? 0}`,
    );
    return new ReplayDataSource(pool, replayFixtureId, speed, maxEvents, startIndex);
  }

  if (!session) {
    throw new Error(`No session for ${agentId} — run scripts/setup-subscription.ts ${agentId} first`);
  }
  console.log(`[${agentId}] LIVE mode — streaming from ${config.apiBaseUrl}`);
  return new LiveTxLineSource(
    config,
    { jwt: session.jwt, apiToken: session.apiToken },
    () => startGuestAuth(config.apiOrigin),
    (err) => console.error(`[${agentId}] stream error`, err),
  );
}

const REPLAY_BACKFILL_SWEEP_MS = 20 * 60 * 1000;

/**
 * TxLINE's `GET /api/scores/historical/{fixtureId}` only serves data for
 * fixtures that started between 6h and 2 weeks ago (see
 * docs/txline-integration.md) — calling it right when `game_finalised`
 * fires (a couple of hours after kickoff) fails outright, data isn't there
 * yet. So instead of an immediate one-shot trigger, this polls periodically
 * for any fixture that's both finished and old enough, and backfills it.
 * Re-running this after a crash/restart costs nothing extra to get right —
 * unlike an in-memory setTimeout, a DB query has no state to lose.
 */
function scheduleReplayBackfillSweep(agentId: string, pool: Pool, store: SignalStore, maybeApiClient: AxiosInstance | undefined): void {
  if (!maybeApiClient) return; // no session -> can't hit TxLINE's REST endpoints either
  const apiClient = maybeApiClient; // narrowed once, outside the closure below

  async function sweep(): Promise<void> {
    const due = await store.findFixturesNeedingReplayBackfill();
    for (const { fixture_id: fixtureId } of due) {
      const client = await pool.connect();
      try {
        const result = await backfillFixture({ apiClient, db: client, fixtureId });
        console.log(
          `[${agentId}] AUTO-BACKFILL fixture=${fixtureId} odds=${result.oddsEventCount} scores=${result.scoreEventCount}`,
        );
      } catch (err) {
        console.error(`[${agentId}] auto-backfill failed for fixture ${fixtureId} — will retry next sweep`, err);
      } finally {
        client.release();
      }
    }
  }

  sweep().catch((err) => console.error(`[${agentId}] replay-backfill sweep failed`, err));
  setInterval(() => {
    sweep().catch((err) => console.error(`[${agentId}] replay-backfill sweep failed`, err));
  }, REPLAY_BACKFILL_SWEEP_MS);
}

const VALIDATION_RECHECK_SWEEP_MS = 20 * 60 * 1000;

/**
 * `checkValidationProof` (agent-runtime's loop.ts) only ever gets one shot,
 * right when `game_finalised` arrives — if TxLINE hadn't anchored that day's
 * Merkle root on-chain yet at that exact moment, the on-chain `validateStatV2`
 * call fails and `grades.validation_proof_checked` is stuck at `false`
 * forever, even though the signal itself graded correctly (reveal + hash
 * verification are unaffected — this is strictly the on-chain-proof bonus
 * check, never a blocker for grading itself, see architecture doc section
 * 12). This periodically retries every grade still marked unchecked; once
 * the root lands on-chain, the retry succeeds and the dashboard's "VERIFIED
 * ON-CHAIN" badge catches up. Same "one owner" reasoning as
 * scheduleReplayBackfillSweep: this is fixture-wide work, not agent-specific
 * (the check result is identical for both agents' signals on that fixture),
 * so only agent-aggressive runs it.
 */
function scheduleValidationRecheckSweep(
  agentId: string,
  store: SignalStore,
  program: Program,
  connection: Connection,
  programId: PublicKey,
  maybeApiClient: AxiosInstance | undefined,
): void {
  if (!maybeApiClient) return; // no session -> can't hit TxLINE's REST endpoints either
  const apiClient = maybeApiClient; // narrowed once, outside the closure below

  async function sweep(): Promise<void> {
    const due = await store.findGradesNeedingValidationRecheck();
    for (const { fixture_id: fixtureId, scores_seq_used: seq, final_outcome: outcome } of due) {
      try {
        const nowValid = await validateFinalScoreOnchain(
          program,
          connection,
          programId,
          apiClient,
          fixtureId,
          seq,
          outcome as "participant1_win" | "participant2_win" | "draw",
        );
        if (nowValid) {
          await store.markFixtureGradesValidationChecked(fixtureId);
          console.log(`[${agentId}] VALIDATION-RECHECK fixture=${fixtureId} now confirmed on-chain`);
        }
      } catch (err) {
        console.error(`[${agentId}] validation recheck failed for fixture ${fixtureId} — will retry next sweep`, err);
      }
    }
  }

  sweep().catch((err) => console.error(`[${agentId}] validation-recheck sweep failed`, err));
  setInterval(() => {
    sweep().catch((err) => console.error(`[${agentId}] validation-recheck sweep failed`, err));
  }, VALIDATION_RECHECK_SWEEP_MS);
}

async function main() {
  assertEnv();

  const agentId = process.env.AGENT_ID!;
  const network = resolveNetworkFromEnv();
  const config = getNetworkConfig(network);
  const wallet = loadWallet(process.env.WALLET_KEYPAIR_PATH!);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const databaseUrl = process.env.DATABASE_URL!;
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveDatabaseSsl(databaseUrl) });
  const store = new SignalStore(pool);

  console.log(`[${agentId}] network=${network} wallet=${wallet.publicKey.toBase58()}`);

  // Session (and therefore Validation Proof cross-checking) is independent
  // of live vs. replay mode — stat-validation is a plain REST call that
  // works against historical fixtures too, so we load it whenever it
  // exists rather than only in LIVE mode.
  const session = loadSession(agentId);
  const source = await buildSource(agentId, config, pool, session);

  const { program } = createProgram(config, wallet);
  const apiClient = session ? createApiClient(config, session.jwt, session.apiToken) : undefined;
  if (!apiClient) {
    console.log(`[${agentId}] no session found — grading will run without on-chain Validation Proof cross-checking`);
  }

  const loop = new AgentLoop({
    agentId,
    windowSeconds: Number(process.env.WINDOW_SECONDS),
    warmupReadings: Number(process.env.WARMUP_READINGS),
    sensitivityMultiplier: Number(process.env.SENSITIVITY_MULTIPLIER),
    wallet,
    connection,
    store,
    source,
    program,
    programId: config.programId,
    apiClient,
    onSignal: (info) =>
      console.log(
        `[${agentId}] SIGNAL fixture=${info.fixtureId} outcome=${info.outcomeKey} pctChange=${info.pctChange.toFixed(4)} commit=${info.commitTxSig}`,
      ),
    onGrade: (info) =>
      console.log(
        `[${agentId}] GRADE fixture=${info.fixtureId} outcome=${info.outcome} correct=${info.correct} reveal=${info.revealTxSig}`,
      ),
    onReconcile: (info) => {
      if (info.recovered > 0 || info.unrecoverable > 0) {
        console.log(`[${agentId}] RECONCILE recovered=${info.recovered} unrecoverable=${info.unrecoverable}`);
      }
    },
    onError: (err) => console.error(`[${agentId}] loop error`, err),
  });

  await loop.start();
  if (!process.env.REPLAY_FIXTURE_ID) scheduleReplayBackfillSweep(agentId, pool, store, apiClient);
  scheduleValidationRecheckSweep(agentId, store, program, connection, config.programId, apiClient);
  await source.start();
  // LiveTxLineSource.start() resolves immediately (the reconnect loops run
  // detached, indefinitely) — only REPLAY mode actually runs to completion.
  if (process.env.REPLAY_FIXTURE_ID) {
    console.log(`[${agentId}] replay finished`);
  } else {
    console.log(`[${agentId}] live streaming started — reconnects automatically on drops, runs indefinitely`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
