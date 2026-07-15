import { SOLANA_CLUSTER, type SolanaCluster } from "./network";

export function truncateMiddle(value: string, head = 6, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** No default cluster param on purpose — every call site must go through SOLANA_CLUSTER, never assume devnet. */
export function solscanTxUrl(signature: string, cluster: SolanaCluster = SOLANA_CLUSTER): string {
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${signature}${clusterParam}`;
}

export function solscanAddressUrl(address: string, cluster: SolanaCluster = SOLANA_CLUSTER): string {
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/account/${address}${clusterParam}`;
}

export function formatOutcomeKey(outcomeKey: string, participant1?: string | null, participant2?: string | null): string {
  if (outcomeKey === "draw") return "Draw";
  if (outcomeKey === "participant1_win") return participant1 ? `${participant1} wins` : "Participant 1 wins";
  if (outcomeKey === "participant2_win") return participant2 ? `${participant2} wins` : "Participant 2 wins";
  return outcomeKey;
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return `${datePart} · ${timePart}`;
}

export function formatSol(sol: number): string {
  return `${sol.toFixed(4)} SOL`;
}
