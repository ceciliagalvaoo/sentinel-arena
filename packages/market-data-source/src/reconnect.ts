/**
 * Exponential backoff for SSE reconnection (architecture doc section 6.2) —
 * hammering the API on every drop risks looking like abuse and wastes the
 * free tier's goodwill. `connect` must reject/throw when the connection
 * dies; it should stay pending for as long as the connection is healthy.
 *
 * Lives here (not in agent-runtime) because it's a MarketDataSource
 * resilience concern, not an agent-decision concern — `LiveTxLineSource` is
 * the one thing that actually needs it.
 */
export class ReconnectingSseClient {
  private attempt = 0;
  private readonly maxDelayMs: number;
  private stopped = false;

  constructor(maxDelayMs = 30_000) {
    this.maxDelayMs = maxDelayMs;
  }

  stop(): void {
    this.stopped = true;
  }

  async connectWithBackoff(connect: () => Promise<void>): Promise<void> {
    while (!this.stopped) {
      try {
        await connect();
        this.attempt = 0; // clean disconnect/reconnect cycle: reset backoff
      } catch {
        if (this.stopped) return;
        const delay = Math.min(1000 * 2 ** this.attempt, this.maxDelayMs);
        this.attempt++;
        await sleep(delay);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
