import { createHash } from "node:crypto";

/**
 * Canonical, hashable representation of a detected signal — see
 * "Payload canônico do sinal" (architecture doc section 3.2). This is the
 * exact object that gets sha256-hashed and committed on-chain, so its shape
 * is effectively frozen: a new field requires bumping `version`, never a
 * silent change to `canonicalize`/`hashPayload`.
 */
export interface SignalPayload {
  version: 1;
  agentId: string;
  fixtureId: number;
  outcomeKey: string;
  oddsMessageId: string;
  oddsTs: number;
  pctBefore: number;
  pctAfter: number;
  pctChange: number;
  detectedAtIso: string;
}

/** Fixed key order, no whitespace — must stay stable across the app's lifetime. */
export function canonicalize(payload: SignalPayload): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

export function hashPayload(payload: SignalPayload): Buffer {
  return createHash("sha256").update(canonicalize(payload), "utf8").digest();
}

export function hashPayloadHex(payload: SignalPayload): string {
  return hashPayload(payload).toString("hex");
}

/**
 * Deterministic idempotency key: the same market event + outcome + agent
 * always yields the same key, so replays/reconnections can never double-commit.
 */
export function computeIdempotencyKey(agentId: string, oddsMessageId: string, outcomeKey: string): string {
  return createHash("sha256").update(`${agentId}:${oddsMessageId}:${outcomeKey}`).digest("hex");
}

export interface SignalCandidate {
  agentId: string;
  fixtureId: number;
  outcomeKey: string;
  oddsMessageId: string;
  oddsTs: number;
  pctBefore: number;
  pctAfter: number;
  pctChange: number;
  detectedAtIso: string;
}

export function buildSignalPayload(candidate: SignalCandidate): SignalPayload {
  return {
    version: 1,
    agentId: candidate.agentId,
    fixtureId: candidate.fixtureId,
    outcomeKey: candidate.outcomeKey,
    oddsMessageId: candidate.oddsMessageId,
    oddsTs: candidate.oddsTs,
    pctBefore: candidate.pctBefore,
    pctAfter: candidate.pctAfter,
    pctChange: candidate.pctChange,
    detectedAtIso: candidate.detectedAtIso,
  };
}
