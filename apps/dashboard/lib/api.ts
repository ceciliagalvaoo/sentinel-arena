import type { AgentAccuracy, AgentRow, SignalWithLifecycle, TrackedFixtureRow, WalletBalanceInfo } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function wsUrl(): string {
  return `${API_BASE_URL.replace(/^http/, "ws")}/ws`;
}

async function getJson<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchAgents(): Promise<AgentRow[]> {
  return getJson<AgentRow[]>("/api/agents");
}

export function fetchAgentAccuracy(agentId: string): Promise<AgentAccuracy> {
  return getJson<AgentAccuracy>(`/api/agents/${agentId}/accuracy`);
}

export function fetchAgentBalance(agentId: string): Promise<WalletBalanceInfo> {
  return getJson<WalletBalanceInfo>(`/api/agents/${agentId}/balance`);
}

export function fetchFixtures(): Promise<TrackedFixtureRow[]> {
  return getJson<TrackedFixtureRow[]>("/api/fixtures");
}

export function fetchSignals(params: { fixtureId?: number; agentId?: string; limit?: number }): Promise<SignalWithLifecycle[]> {
  return getJson<SignalWithLifecycle[]>("/api/signals", params);
}

export interface VerificationResult {
  valid: boolean;
  checks: {
    signalIdsMatch: boolean;
    referencesCorrectCommit: boolean;
    hashesMatch: boolean;
    commitBeforeReveal: boolean;
  };
  commitSlot: number | null;
  revealSlot: number | null;
}

export async function verifyProof(commitTxSig: string, revealTxSig: string): Promise<VerificationResult> {
  const url = new URL(`${API_BASE_URL}/api/verify`);
  url.searchParams.set("commitTxSig", commitTxSig);
  url.searchParams.set("revealTxSig", revealTxSig);
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `verify failed: ${res.status}`);
  return body as VerificationResult;
}
