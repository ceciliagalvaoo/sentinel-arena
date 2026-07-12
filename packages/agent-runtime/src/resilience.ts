import type { Connection, PublicKey } from "@solana/web3.js";

/**
 * Periodic wallet balance check so a commit/reveal transaction never fails
 * mid-flight because SOL ran out — pause gracefully and alert instead
 * (architecture doc section 6.2). Fires `onBalanceUpdate` on every tick
 * (not just when low) so the caller can resume as cleanly as it paused,
 * once the wallet is topped up. Returns a stop function.
 */
export function monitorWalletBalance(
  connection: Connection,
  wallet: PublicKey,
  minLamports: number,
  onBalanceUpdate: (isLow: boolean, currentLamports: number) => void,
  intervalMs = 60_000,
): () => void {
  const timer = setInterval(() => {
    connection
      .getBalance(wallet)
      .then((balance) => {
        onBalanceUpdate(balance < minLamports, balance);
      })
      .catch((err: unknown) => {
        console.error("monitorWalletBalance: failed to fetch balance", err);
      });
  }, intervalMs);

  return () => clearInterval(timer);
}
