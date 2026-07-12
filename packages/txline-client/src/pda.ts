import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/** Program-config PDAs — same seeds on mainnet and devnet, only the programId differs. */
export function getPricingMatrixPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], programId);
}

export function getTokenTreasuryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], programId);
}

export function getUsdtTreasuryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("usdt_treasury")], programId);
}

export function epochDayFromTimestampMs(timestampMs: number): number {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) {
    throw new Error("Expected a non-negative timestamp in milliseconds");
  }
  const epochDay = Math.floor(timestampMs / 86_400_000);
  if (epochDay > 0xffff) throw new Error("Timestamp is outside the u16 epoch-day range");
  return epochDay;
}

/** Daily Merkle root PDA for Scores — derive epochDay from the SAME timestamp used in validateStat(V2). */
export function getDailyScoresRootsPda(programId: PublicKey, timestampMs: number): [PublicKey, number] {
  const epochDay = epochDayFromTimestampMs(timestampMs);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    programId,
  );
}

/** Daily Merkle root PDA for Odds. */
export function getDailyBatchRootsPda(programId: PublicKey, timestampMs: number): [PublicKey, number] {
  const epochDay = epochDayFromTimestampMs(timestampMs);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_batch_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    programId,
  );
}

/** Fixtures root PDA — aligned to 10-day blocks. */
export function getTenDailyFixturesRootsPda(programId: PublicKey, timestampMs: number): [PublicKey, number] {
  const epochDay = epochDayFromTimestampMs(timestampMs);
  const alignedEpochDay = Math.floor(epochDay / 10) * 10;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ten_daily_fixtures_roots"), new BN(alignedEpochDay).toArrayLike(Buffer, "le", 2)],
    programId,
  );
}
