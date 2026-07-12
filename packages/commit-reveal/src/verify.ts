import bs58 from "bs58";
import type { Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import type { VerificationResult } from "@sentinel/shared-types";
import { COMMIT_PREFIX, MEMO_PROGRAM_ID, REVEAL_PREFIX } from "./memo.js";

export class MalformedMemoError extends Error {
  constructor(context: string) {
    super(`Malformed or missing memo: ${context}`);
    this.name = "MalformedMemoError";
  }
}

/**
 * Extracts the memo text from a confirmed transaction. Handles both shapes
 * the RPC can return for the memo program depending on the encoding: a
 * jsonParsed instruction where `parsed` is the string directly, and a
 * partially-decoded instruction where `data` is base58 and must be decoded.
 */
export function extractMemoText(tx: ParsedTransactionWithMeta | null): string {
  if (!tx) throw new MalformedMemoError("transaction not found");

  for (const ix of tx.transaction.message.instructions) {
    const programId = "programId" in ix ? ix.programId : undefined;
    if (!programId || !programId.equals(MEMO_PROGRAM_ID)) continue;

    if ("parsed" in ix && typeof ix.parsed === "string") {
      return ix.parsed;
    }
    if ("data" in ix && typeof ix.data === "string") {
      return Buffer.from(bs58.decode(ix.data)).toString("utf8");
    }
  }

  throw new MalformedMemoError("no memo-program instruction in transaction");
}

interface ParsedCommitMemo {
  agentId: string;
  signalId: string;
  hashHex: string;
}

interface ParsedRevealMemo {
  signalId: string;
  commitTxSig: string;
  recomputedHash: string;
}

export function parseCommitMemo(memoText: string): ParsedCommitMemo {
  const parts = memoText.split("|");
  if (parts.length !== 5 || parts[0] !== COMMIT_PREFIX) {
    throw new MalformedMemoError(`expected ${COMMIT_PREFIX}|v1|agentId|signalId|hashHex, got "${memoText}"`);
  }
  const [, , agentId, signalId, hashHex] = parts as [string, string, string, string, string];
  return { agentId, signalId, hashHex };
}

export function parseRevealMemo(memoText: string): ParsedRevealMemo {
  const parts = memoText.split("|");
  if (parts.length !== 5 || parts[0] !== REVEAL_PREFIX) {
    throw new MalformedMemoError(`expected ${REVEAL_PREFIX}|v1|signalId|commitTxSig|recomputedHash, got "${memoText}"`);
  }
  const [, , signalId, commitTxSig, recomputedHash] = parts as [string, string, string, string, string];
  return { signalId, commitTxSig, recomputedHash };
}

/**
 * The public, third-party-usable verification routine (architecture doc
 * section 4.3). Works for any pair of commit/reveal tx signatures produced
 * with this memo format — not hardcoded to the two Sentinel agents.
 */
export async function verifySignalProof(
  connection: Connection,
  commitTxSig: string,
  revealTxSig: string,
): Promise<VerificationResult> {
  const [commitTx, revealTx] = await Promise.all([
    connection.getParsedTransaction(commitTxSig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }),
    connection.getParsedTransaction(revealTxSig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }),
  ]);

  const commitMemo = parseCommitMemo(extractMemoText(commitTx));
  const revealMemo = parseRevealMemo(extractMemoText(revealTx));

  const checks = {
    signalIdsMatch: commitMemo.signalId === revealMemo.signalId,
    referencesCorrectCommit: revealMemo.commitTxSig === commitTxSig,
    hashesMatch: commitMemo.hashHex === revealMemo.recomputedHash,
    commitBeforeReveal: (commitTx?.blockTime ?? 0) < (revealTx?.blockTime ?? Number.POSITIVE_INFINITY),
  };

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    commitSlot: commitTx?.slot ?? null,
    revealSlot: revealTx?.slot ?? null,
  };
}
