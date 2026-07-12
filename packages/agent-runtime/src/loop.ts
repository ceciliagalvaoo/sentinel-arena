import { randomUUID } from "node:crypto";
import type { Program } from "@coral-xyz/anchor";
import type { Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { AxiosInstance } from "axios";
import {
  buildSignalPayload,
  computeIdempotencyKey,
  extractOutcomePct,
  hashPayloadHex,
  isGameFinalised,
  MIN_LAMPORTS_WARNING,
  type OddsEvent,
  type ScoreEvent,
} from "@sentinel/shared-types";
import type { MarketDataSource } from "@sentinel/market-data-source";
import { publishCommit, publishReveal } from "@sentinel/commit-reveal";
import { fetchFixturesSnapshot, validateFinalScoreOnchain, validateSignalOddsOnchain } from "@sentinel/txline-client";
import { MultiFixtureAgentState } from "./state.js";
import { SignalStore, type OrphanedSignal, type PendingSignal, type UnrecoverableOrphanedSignal } from "./store.js";
import { monitorWalletBalance } from "./resilience.js";
import {
  DEFAULT_MARKET_FILTER,
  determineOutcome,
  mapPriceNameToOutcomeKey,
  matchesMarketFilter,
  type FinalOutcome,
  type MarketFilter,
} from "./market.js";

const TX_SPACING_MS = 400; // minimum gap between queued Solana tx publishes — see AgentLoop docstring

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SignalFiredInfo {
  signalId: string;
  fixtureId: number;
  outcomeKey: string;
  pctChange: number;
  commitTxSig: string;
}

export interface GradeSettledInfo {
  signalId: string;
  fixtureId: number;
  outcome: string;
  correct: boolean;
  revealTxSig: string;
}

export interface AgentLoopConfig {
  agentId: string;
  windowSeconds: number;
  warmupReadings: number;
  sensitivityMultiplier: number;
  wallet: Keypair;
  connection: Connection;
  store: SignalStore;
  source: MarketDataSource;
  marketFilter?: MarketFilter;
  /**
   * Optional on-chain cross-check of the final score via validateStatV2
   * (architecture doc section 5.12/7). All three must be provided together
   * to enable it; if omitted, `validation_proof_checked` stays false and
   * grading still proceeds normally — this is an integrity bonus, never a
   * blocker (section 12 risk table).
   */
  program?: Program;
  programId?: PublicKey;
  apiClient?: AxiosInstance;
  onSignal?: (info: SignalFiredInfo) => void;
  onGrade?: (info: GradeSettledInfo) => void;
  onReconcile?: (info: { recovered: number; unrecoverable: number }) => void;
  onError?: (err: unknown) => void;
}

/**
 * The full autonomous loop (architecture doc section 5.2): ingest odds ->
 * detect -> commit -> ingest scores -> detect finalisation -> reveal ->
 * grade. Nothing here requires a human after `start()` is called — that's
 * the literal, eliminatory "Autonomous Operation" judging criterion
 * (section 0.2).
 *
 * v1 scope: soccer 1X2 market only, StablePrice consensus feed only
 * (market.ts). `validation_proof_checked` is only ever true if `program`/
 * `programId`/`apiClient` are configured (see AgentLoopConfig) — Validation
 * Proof cross-checking (validateStatV2) is never a blocker for the
 * commit-reveal loop itself (architecture doc section 12 risk table:
 * commits never depend on a proof being available yet).
 *
 * Discovered during replay testing (2026-07-12): MarketDataSource handlers
 * are fire-and-forget (never awaited by the source), so a burst of odds
 * ticks — e.g. a fast-forwarded replay, or genuinely volatile real trading
 * moments — can trigger many concurrent publishCommit/publishReveal calls
 * and get rate-limited (429) by the public devnet RPC. Detection
 * (window/threshold updates) stays synchronous and un-queued so it never
 * falls behind; only the actual Solana transaction publishing is serialized
 * through `txQueue`, one at a time with a minimum spacing (`TX_SPACING_MS`),
 * in the order signals were detected.
 *
 * A second bug this uncovered: game_finalised settlement must go through the
 * SAME queue as commits, as one unit — otherwise it can run while earlier
 * commits are still queued (not yet persisted), and
 * `findPendingSignalsByFixture` would silently miss them (no `commits` row
 * yet to join against), permanently losing their reveal/grade.
 *
 * Self-healing on start(): a crash between `tryCreateSignal` succeeding and
 * `publishCommit` landing leaves an orphaned `signals` row with no
 * `commits` row — the idempotency guard means that exact detection can
 * never fire again, so without reconciliation it's permanently stuck.
 * `start()` finds these and republishes their commit late using the
 * already-frozen payload hash, but ONLY for fixtures this agent hasn't
 * already graded — a commit published after the result is knowable is
 * worthless as a predictive claim, so those are logged as unrecoverable
 * instead of silently "fixed".
 */
export class AgentLoop {
  private readonly state = new MultiFixtureAgentState();
  private readonly marketFilter: MarketFilter;
  private stopWalletMonitor: (() => void) | null = null;
  private txQueue: Promise<unknown> = Promise.resolve();
  /** Set by the wallet monitor below — gates new commits, never existing reveals in flight. */
  private paused = false;
  /** fixtureIds already upserted into tracked_fixtures this run — see ensureFixtureRegistered(). */
  private readonly registeredFixtures = new Set<number>();

  constructor(private readonly config: AgentLoopConfig) {
    this.marketFilter = config.marketFilter ?? DEFAULT_MARKET_FILTER;
  }

  async start(): Promise<void> {
    await this.reconcileOrphanedSignals();

    this.config.source.onOdds((event) => {
      this.handleOdds(event).catch((err) => this.reportError(err));
    });
    this.config.source.onScore((event) => {
      this.handleScore(event).catch((err) => this.reportError(err));
    });

    this.stopWalletMonitor = monitorWalletBalance(this.config.connection, this.config.wallet.publicKey, MIN_LAMPORTS_WARNING, (isLow, balance) => {
      if (isLow && !this.paused) {
        console.warn(`[${this.config.agentId}] wallet balance low (${balance} lamports) — pausing new commits until topped up`);
      } else if (!isLow && this.paused) {
        console.log(`[${this.config.agentId}] wallet balance recovered (${balance} lamports) — resuming commits`);
      }
      this.paused = isLow;
    });
  }

  /** Runs once at startup — see class docstring "Self-healing on start()". */
  private async reconcileOrphanedSignals(): Promise<void> {
    const [orphaned, unrecoverable] = await Promise.all([
      this.config.store.findOrphanedSignals(this.config.agentId),
      this.config.store.findUnrecoverableOrphanedSignals(this.config.agentId),
    ]);

    if (unrecoverable.length > 0) {
      console.warn(
        `[${this.config.agentId}] ${unrecoverable.length} orphaned signal(s) can NOT be reconciled — their fixture was already graded, so a late commit would be dishonest: ${unrecoverable
          .map((s: UnrecoverableOrphanedSignal) => `${s.id}(fixture ${s.fixture_id})`)
          .join(", ")}`,
      );
    }

    if (orphaned.length > 0) {
      console.warn(`[${this.config.agentId}] reconciling ${orphaned.length} orphaned signal(s) from a previous crash...`);
      for (const signal of orphaned) {
        this.enqueueTx(() => this.publishOrphanedCommit(signal)).catch((err) => this.reportError(err));
      }
    }

    this.config.onReconcile?.({ recovered: orphaned.length, unrecoverable: unrecoverable.length });
  }

  private async publishOrphanedCommit(signal: OrphanedSignal): Promise<void> {
    const commitTxSig = await publishCommit(this.config.connection, this.config.wallet, signal.id, signal.payload_hash, this.config.agentId);
    await this.config.store.insertCommit(signal.id, commitTxSig, null);
    console.log(`[${this.config.agentId}] reconciled orphaned signal ${signal.id} (fixture ${signal.fixture_id}) -> commit ${commitTxSig}`);
  }

  stop(): void {
    this.stopWalletMonitor?.();
    this.stopWalletMonitor = null;
  }

  private reportError(err: unknown): void {
    if (this.config.onError) this.config.onError(err);
    else console.error(`[${this.config.agentId}] loop error`, err);
  }

  /** Serializes Solana transaction publishing (with spacing) so a burst of detections never fires concurrent RPC calls. */
  private enqueueTx<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.txQueue.then(() => sleep(TX_SPACING_MS)).then(fn);
    this.txQueue = result.then(
      () => undefined,
      () => undefined, // one failed tx must not poison the queue for the next one
    );
    return result;
  }

  /**
   * `signals.fixture_id` is a NOT NULL foreign key into `tracked_fixtures`,
   * and in LIVE mode nothing else ever creates that row (only the backfill
   * script does, and only for already-finished fixtures) — without this,
   * the very first signal for a genuinely new live fixture would fail on
   * the FK constraint. This is also the only thing that makes a live match
   * show up at all in the dashboard's "Live" selector (it filters on
   * status='live'). Fetching real metadata (team names, competition) is
   * best-effort — a failed lookup still registers a bare row so signal
   * detection is never blocked on it, matching the "never let an optional
   * enrichment block the core pipeline" pattern used for validation checks.
   */
  private async ensureFixtureRegistered(fixtureId: number): Promise<void> {
    if (this.registeredFixtures.has(fixtureId)) return;

    let participant1: string | null = null;
    let participant2: string | null = null;
    let competition: string | null = null;
    let startTimeMs: number | null = null;

    if (this.config.apiClient) {
      try {
        const fixtures = await fetchFixturesSnapshot(this.config.apiClient);
        const fixture = fixtures.find((f) => f.FixtureId === fixtureId);
        if (fixture) {
          participant1 = fixture.Participant1 ?? null;
          participant2 = fixture.Participant2 ?? null;
          competition = fixture.Competition ?? null;
          startTimeMs = fixture.StartTime ?? null;
        }
      } catch (err) {
        this.reportError(err);
      }
    }

    await this.config.store.upsertLiveFixture(fixtureId, participant1, participant2, competition, startTimeMs);
    this.registeredFixtures.add(fixtureId);
  }

  private async handleOdds(event: OddsEvent): Promise<void> {
    if (!matchesMarketFilter(event, this.marketFilter)) return;
    await this.ensureFixtureRegistered(event.fixtureId);

    for (const priceName of event.priceNames) {
      const outcomeKey = mapPriceNameToOutcomeKey(priceName);
      if (!outcomeKey) continue;

      const pct = extractOutcomePct(event, priceName);
      if (pct === null) continue;

      const trackingKey = `${event.fixtureId}:${outcomeKey}`;
      const window = this.state.getOrCreateWindow(trackingKey, this.config.windowSeconds);
      const threshold = this.state.getOrCreateThreshold(trackingKey, this.config.warmupReadings, this.config.sensitivityMultiplier);

      window.push(event.ts, pct);
      const pctChange = window.pctChangeSinceWindowStart();
      if (pctChange === null) continue;

      threshold.observe(pctChange);
      if (!threshold.isReady()) continue; // still warming up — observe only, never fire
      if (Math.abs(pctChange) < threshold.getThreshold()) continue;
      // Wallet too low to safely land a commit tx — drop this candidate rather
      // than attempt (and fail) the transaction (architecture doc section 6.2).
      if (this.paused) continue;

      const pctBefore = window.getOldestPrice() ?? pct;
      this.enqueueTx(() => this.fireSignal(event, outcomeKey, pctBefore, pct, pctChange)).catch((err) => this.reportError(err));
    }
  }

  private async fireSignal(
    event: OddsEvent,
    outcomeKey: string,
    pctBefore: number,
    pctAfter: number,
    pctChange: number,
  ): Promise<void> {
    const signalId = randomUUID();
    const payload = buildSignalPayload({
      agentId: this.config.agentId,
      fixtureId: event.fixtureId,
      outcomeKey,
      oddsMessageId: event.messageId,
      oddsTs: event.ts,
      pctBefore,
      pctAfter,
      pctChange,
      detectedAtIso: new Date().toISOString(),
    });
    const payloadHash = hashPayloadHex(payload);
    const idempotencyKey = computeIdempotencyKey(this.config.agentId, event.messageId, outcomeKey);

    const created = await this.config.store.tryCreateSignal({
      id: signalId,
      agentId: this.config.agentId,
      fixtureId: event.fixtureId,
      outcomeKey,
      oddsMessageId: event.messageId,
      oddsTs: event.ts,
      pctBefore,
      pctAfter,
      pctChange,
      payload,
      payloadHash,
      idempotencyKey,
    });
    if (!created) return; // idempotency guard: this exact event+outcome+agent was already committed

    const commitTxSig = await publishCommit(this.config.connection, this.config.wallet, signalId, payloadHash, this.config.agentId);
    await this.config.store.insertCommit(signalId, commitTxSig, null);

    this.config.onSignal?.({ signalId, fixtureId: event.fixtureId, outcomeKey, pctChange, commitTxSig });
  }

  private async handleScore(event: ScoreEvent): Promise<void> {
    if (!isGameFinalised(event)) return;

    // Enqueued as ONE unit so it only runs once every earlier-queued commit
    // for this fixture has actually landed — see class docstring.
    this.enqueueTx(() => this.settleFixture(event)).catch((err) => this.reportError(err));
  }

  private async settleFixture(event: ScoreEvent): Promise<void> {
    // Runs even when this agent has nothing pending to grade (e.g. Conservative
    // never fired on a calm match) — otherwise the fixture would stay stuck on
    // "live" in the dashboard forever after the real match already ended.
    await this.config.store.markFixtureFinished(event.fixtureId);

    const pending = await this.config.store.findPendingSignalsByFixture(event.fixtureId, this.config.agentId);
    if (pending.length === 0) return;

    const outcome = determineOutcome(event.raw);
    // Once per fixture, not per signal (architecture doc section 7) — all
    // pending signals for this fixture settle against the same proof check.
    const validationProofChecked = await this.checkValidationProof(event.fixtureId, event.seq, outcome);

    for (const signal of pending) {
      // Sequential on purpose — already inside the single queued slot, and
      // reveal spacing matters here too.
      await sleep(TX_SPACING_MS);
      await this.settleSignal(signal, outcome, event.fixtureId, event.seq, validationProofChecked);
    }
  }

  /** Never throws — a failed/unavailable proof check must not block grading itself (architecture doc section 12). */
  private async checkValidationProof(fixtureId: number, seq: number, outcome: FinalOutcome): Promise<boolean> {
    const { program, programId, apiClient, connection } = this.config;
    if (!program || !programId || !apiClient) return false;

    try {
      return await validateFinalScoreOnchain(program, connection, programId, apiClient, fixtureId, seq, outcome);
    } catch (err) {
      this.reportError(err);
      return false;
    }
  }

  /**
   * Per-signal counterpart to checkValidationProof: confirms on-chain that
   * the specific odds tick which triggered THIS signal (not just the final
   * score) is anchored in TxLINE's Merkle root — optional per architecture
   * doc section 4.1 step 5, but run for real here rather than left as a
   * library function nobody calls. Never throws, same reasoning as above.
   */
  private async checkOddsProof(oddsMessageId: string, oddsTs: number): Promise<boolean> {
    const { program, programId, apiClient, connection } = this.config;
    if (!program || !programId || !apiClient) return false;

    try {
      return await validateSignalOddsOnchain(program, connection, programId, apiClient, oddsMessageId, oddsTs);
    } catch (err) {
      this.reportError(err);
      return false;
    }
  }

  private async settleSignal(
    signal: PendingSignal,
    outcome: string,
    fixtureId: number,
    scoresSeq: number,
    validationProofChecked: boolean,
  ): Promise<void> {
    const correct = signal.outcome_key === outcome;
    const oddsProofChecked = await this.checkOddsProof(signal.payload_json.oddsMessageId, signal.payload_json.oddsTs);
    const { revealTxSig, recomputedHash } = await publishReveal(
      this.config.connection,
      this.config.wallet,
      signal.id,
      signal.commit_tx_sig,
      signal.payload_json,
    );
    const hashVerified = recomputedHash === hashPayloadHex(signal.payload_json);
    await this.config.store.insertReveal(signal.id, revealTxSig, hashVerified);
    await this.config.store.insertGrade(signal.id, outcome, correct, scoresSeq, validationProofChecked, oddsProofChecked);

    this.config.onGrade?.({ signalId: signal.id, fixtureId, outcome, correct, revealTxSig });
  }
}
