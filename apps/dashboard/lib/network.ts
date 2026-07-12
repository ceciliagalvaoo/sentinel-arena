export type SolanaCluster = "devnet" | "mainnet-beta";

/**
 * Single source of truth for which Solana cluster the dashboard links to on
 * Solscan — sentinel-dashboard-dev principle #3 explicitly forbids hardcoding
 * "devnet" in the URL builders themselves, since the backend/agents could be
 * pointed at mainnet. Every Solscan link in the app reads this constant.
 */
export const SOLANA_CLUSTER: SolanaCluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaCluster) ?? "devnet";
