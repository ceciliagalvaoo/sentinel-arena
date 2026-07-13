/**
 * Row types mirroring db/migrations/0001_init.sql exactly (architecture doc
 * section 3.1). Column names are camelCased here; the data-access layer in
 * apps/backend-api and packages/agent-runtime is responsible for mapping
 * snake_case columns to these shapes.
 */

export type AgentId = "agent-aggressive" | "agent-conservative" | (string & {});

/**
 * Below this many lamports, an agent pauses new commits (architecture doc
 * section 6.2 — "pausa graciosamente" instead of letting a tx fail
 * mid-flight). Shared between packages/agent-runtime (which enforces it) and
 * apps/backend-api's wallet-balance route (which reports the same threshold
 * as WalletBalanceInfo.status), so the two can never drift apart.
 */
export const MIN_LAMPORTS_WARNING = 10_000_000; // ~0.01 SOL — plenty of runway for memo tx fees

/**
 * Managed Postgres (Supabase, Render Postgres, etc.) requires TLS; the local
 * docker-compose Postgres has none configured. Every `new Pool()`/`new
 * Client()` call site (apps/agent-*, apps/backend-api, scripts/*) should
 * pass this instead of hand-rolling the same host check.
 */
export function resolveDatabaseSsl(connectionString: string): { rejectUnauthorized: false } | undefined {
  const isLocalHost = /(^|@)(localhost|127\.0\.0\.1|postgres)(:|\/)/.test(connectionString);
  return isLocalHost ? undefined : { rejectUnauthorized: false };
}

export interface AgentRow {
  id: AgentId;
  strategyName: string;
  /** k: 1.5 (aggressive) or 3.0 (conservative) — see AutoCalibratedThreshold */
  sensitivityMultiplier: number;
  windowSeconds: number;
  warmupReadings: number;
  walletPubkey: string;
  createdAt: string;
}

/**
 * GET /api/agents/:agentId/balance response. `status` piggybacks on the
 * balance fetch this endpoint already makes — deriving it via a SEPARATE
 * RPC call (as an earlier version of this code did on /api/agents) doubles
 * getBalance traffic against the public devnet RPC, which is slow/flaky
 * enough (multi-second spikes observed) to make the whole dashboard load
 * intermittently time out and fall back to mock data. One getBalance call
 * per agent, reused for both the SOL figure and the paused/active status.
 */
export interface WalletBalanceInfo {
  lamports: number;
  sol: number;
  status: "active" | "paused";
}

export type FixtureStatus = "scheduled" | "live" | "finished";

export interface TrackedFixtureRow {
  fixtureId: number;
  competition: string | null;
  participant1: string | null;
  participant2: string | null;
  startTime: string | null;
  status: FixtureStatus;
  /**
   * true when this fixture's data was observed live, tick-by-tick, as it
   * happened (packages/agent-runtime's upsertLiveFixture). false when it was
   * reconstructed after the fact via REST backfill (recorder-service) — in
   * that case every signal's detectedAt/committedAt/revealedAt reflect when
   * OUR system processed the replay, not the original match time, since the
   * on-chain transaction only knows about the moment it actually happened.
   * The dashboard uses this to caption timestamps honestly instead of
   * rewriting them to "look" live.
   */
  capturedLive: boolean;
}

export interface CalibratedThresholdRow {
  agentId: AgentId;
  fixtureId: number;
  thresholdValue: number;
  calibratedAt: string;
}

export interface SignalRow {
  id: string;
  agentId: AgentId;
  fixtureId: number;
  outcomeKey: string;
  oddsMessageId: string;
  oddsTs: number;
  pctBefore: number;
  pctAfter: number;
  pctChange: number;
  detectedAt: string;
  payloadJson: Record<string, unknown>;
  payloadHash: string;
  idempotencyKey: string;
}

export interface CommitRow {
  signalId: string;
  commitTxSig: string;
  commitSlot: number | null;
  committedAt: string;
}

export interface RevealRow {
  signalId: string;
  revealTxSig: string;
  revealedAt: string;
  hashVerified: boolean;
}

export interface GradeRow {
  signalId: string;
  finalOutcome: string;
  correct: boolean;
  scoresSeqUsed: number;
  /** Once per fixture: the final score used for grading is anchored in TxLINE's on-chain Merkle root. */
  validationProofChecked: boolean;
  /** Once per signal: the specific odds tick that triggered THIS signal is anchored on-chain (validate_odds) — see packages/txline-client/src/validation.ts. */
  oddsProofChecked: boolean;
  gradedAt: string;
}

export type RecordedEventType = "odds" | "score";

export interface RecordedEventRow {
  id: number;
  fixtureId: number;
  eventType: RecordedEventType;
  rawPayload: Record<string, unknown>;
  recordedAt: string;
  sequenceIndex: number;
}

/** Joined view used by the grading engine and dashboard feed (signal + its lifecycle so far). */
export interface SignalWithLifecycle extends SignalRow {
  commit: CommitRow | null;
  reveal: RevealRow | null;
  grade: GradeRow | null;
}

/** Aggregated per-agent accuracy, as exposed by backend-api and consumed by the dashboard. */
export interface AgentAccuracy {
  agentId: AgentId;
  correctSignals: number;
  totalGradedSignals: number;
  accuracy: number; // correctSignals / totalGradedSignals, 0 when totalGradedSignals === 0
  /**
   * True only if EVERY graded signal for this agent has validation_proof_checked
   * = true — computed over the full set, not a recent sample, so a dashboard
   * "verified on-chain" badge built from this is never shown optimistically
   * (sentinel-dashboard-dev principle #4). Optional because not every
   * producer of AgentAccuracy computes it (e.g. agent-runtime's internal copy).
   */
  allValidationChecked?: boolean;
}
