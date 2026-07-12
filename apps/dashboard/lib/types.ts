/**
 * Mirrors @sentinel/shared-types + apps/backend-api's REST/WebSocket contract
 * exactly, so swapping mock data for the real API later is a drop-in, not a
 * rewrite. See apps/backend-api/src/db.ts and packages/shared-types/src/db.ts
 * for the source of truth.
 */

export type AgentId = "agent-aggressive" | "agent-conservative";

export interface AgentRow {
  id: AgentId;
  strategyName: string;
  sensitivityMultiplier: number;
  windowSeconds: number;
  warmupReadings: number;
  walletPubkey: string;
  createdAt: string;
}

export interface AgentAccuracy {
  agentId: string;
  correctSignals: number;
  totalGradedSignals: number;
  accuracy: number;
  /** True only if EVERY graded signal (not just the recent ones the feed shows) had its Validation Proof checked on-chain. */
  allValidationChecked?: boolean;
}

export type FixtureStatus = "scheduled" | "live" | "finished";

export interface TrackedFixtureRow {
  fixtureId: number;
  competition: string | null;
  participant1: string | null;
  participant2: string | null;
  startTime: string | null;
  status: FixtureStatus;
  /** false when this match's data was reconstructed after the fact via backfill rather than observed live — see app/page.tsx's caveat banner. */
  capturedLive: boolean;
}

export interface CommitInfo {
  commitTxSig: string;
  commitSlot: number | null;
  committedAt: string;
}

export interface RevealInfo {
  revealTxSig: string;
  revealedAt: string;
  hashVerified: boolean;
}

export interface GradeInfo {
  finalOutcome: string;
  correct: boolean;
  scoresSeqUsed: number;
  validationProofChecked: boolean;
  /** Per-signal on-chain proof that the odds tick which triggered this specific signal (not just the final score) is genuine. */
  oddsProofChecked: boolean;
  gradedAt: string;
}

export interface SignalWithLifecycle {
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
  payloadHash: string;
  commit: CommitInfo | null;
  reveal: RevealInfo | null;
  grade: GradeInfo | null;
}

export interface WalletBalanceInfo {
  lamports: number;
  sol: number;
  /** Derived server-side from this same balance fetch (paused = below the tx-fee safety floor) — no separate RPC call. */
  status: "active" | "paused";
}

/** Everything one agent card needs — composed from the endpoints above plus a live wallet balance lookup. */
export interface AgentCardData {
  agent: AgentRow;
  accuracy: AgentAccuracy;
  wallet: WalletBalanceInfo;
  status: "active" | "paused";
  recentSignals: SignalWithLifecycle[];
}
