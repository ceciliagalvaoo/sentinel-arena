import type { Connection, PublicKey } from "@solana/web3.js";

const BALANCE_CHECK_TIMEOUT_MS = 15_000;

/**
 * `Connection.getBalance` has no built-in timeout — a stalled TCP connection
 * (no error, no data, just silence) leaves the promise pending forever. That
 * silently wedged this exact interval in production on 2026-07-15: the last
 * log line before ~3.5h of total silence was this call's own error handler,
 * then nothing, because the next tick's promise never settled either way.
 * Racing it against a timeout guarantees every tick either succeeds or logs
 * an error — it can never again vanish without a trace.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

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
    withTimeout(connection.getBalance(wallet), BALANCE_CHECK_TIMEOUT_MS, `getBalance timed out after ${BALANCE_CHECK_TIMEOUT_MS}ms`)
      .then((balance) => {
        onBalanceUpdate(balance < minLamports, balance);
      })
      .catch((err: unknown) => {
        console.error("monitorWalletBalance: failed to fetch balance", err);
      });
  }, intervalMs);

  return () => clearInterval(timer);
}
