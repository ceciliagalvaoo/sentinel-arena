import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import type { NetworkConfig } from "./config.js";

/**
 * Builds an AnchorProvider + Program bound to `config`'s network. Also
 * asserts the loaded IDL's program address matches the network's known
 * programId (architecture doc "golden rule" — never let a mismatched
 * IDL/network pair silently proceed).
 */
export function createProgram(config: NetworkConfig, payer: Keypair): { connection: Connection; program: anchor.Program } {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(config.idl, provider);

  if (!program.programId.equals(config.programId)) {
    throw new Error(
      `IDL program ${program.programId.toBase58()} != ${config.network} program ${config.programId.toBase58()}`,
    );
  }

  return { connection, program };
}
