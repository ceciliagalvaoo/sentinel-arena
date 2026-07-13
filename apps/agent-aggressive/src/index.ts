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
 */
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Connection, Keypair } from "@solana/web3.js";
import { Pool } from "pg";
import { createApiClient, createProgram, getNetworkConfig, resolveNetworkFromEnv, startGuestAuth } from "@sentinel/txline-client";
import { LiveTxLineSource, ReplayDataSource, type MarketDataSource } from "@sentinel/market-data-source";
import { AgentLoop, SignalStore } from "@sentinel/agent-runtime";
import { resolveDatabaseSsl } from "@sentinel/shared-types";

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
