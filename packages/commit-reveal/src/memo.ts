import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { hashPayloadHex, type SignalPayload } from "@sentinel/shared-types";

/** SPL Memo Program v2 — same address on mainnet and devnet. */
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export const COMMIT_PREFIX = "SENTINEL_COMMIT";
export const REVEAL_PREFIX = "SENTINEL_REVEAL";
export const MEMO_FORMAT_VERSION = "v1";

export function buildMemoInstruction(memoText: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText, "utf8"),
  });
}

export function buildCommitMemoText(agentId: string, signalId: string, hashHex: string): string {
  return `${COMMIT_PREFIX}|${MEMO_FORMAT_VERSION}|${agentId}|${signalId}|${hashHex}`;
}

export function buildRevealMemoText(signalId: string, commitTxSig: string, recomputedHash: string): string {
  return `${REVEAL_PREFIX}|${MEMO_FORMAT_VERSION}|${signalId}|${commitTxSig}|${recomputedHash}`;
}

/**
 * Publishes the commit memo — signer must be the specific agent's own wallet
 * (never a shared keypair, see architecture doc section 5.1). Does not wait
 * for a Validation Proof to exist; the commit only needs the payload hash.
 */
export async function publishCommit(
  connection: Connection,
  payer: Keypair,
  signalId: string,
  hashHex: string,
  agentId: string,
): Promise<string> {
  const memoText = buildCommitMemoText(agentId, signalId, hashHex);
  const ix = buildMemoInstruction(memoText, payer.publicKey);
  const tx = new Transaction().add(ix);
  const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

/**
 * Publishes the reveal memo, recomputing the hash from the full payload
 * (never trusting a previously stored hash) so the memo itself is a fresh,
 * independently-verifiable claim.
 */
export async function publishReveal(
  connection: Connection,
  payer: Keypair,
  signalId: string,
  commitTxSig: string,
  payload: SignalPayload,
): Promise<{ revealTxSig: string; recomputedHash: string }> {
  const recomputedHash = hashPayloadHex(payload);
  const memoText = buildRevealMemoText(signalId, commitTxSig, recomputedHash);
  const ix = buildMemoInstruction(memoText, payer.publicKey);
  const tx = new Transaction().add(ix);
  const revealTxSig = await connection.sendTransaction(tx, [payer], { skipPreflight: false });
  await connection.confirmTransaction(revealTxSig, "confirmed");
  return { revealTxSig, recomputedHash };
}
