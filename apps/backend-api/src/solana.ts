import { Connection } from "@solana/web3.js";

/**
 * Single shared RPC connection for the whole backend process. Network is
 * driven entirely by SOLANA_RPC_URL — never hardcode a cluster URL anywhere
 * else in this app (architecture doc "golden rule", solana-expert section 5.1).
 */
export function createConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error("SOLANA_RPC_URL is not set");
  return new Connection(rpcUrl, "confirmed");
}
