/** Sliding window of recent odds prices for a single (fixtureId, outcome) pair. */
export class SlidingOddsWindow {
  private buffer: Array<{ ts: number; price: number }> = [];

  constructor(private readonly windowSeconds: number) {}

  push(ts: number, price: number): void {
    this.buffer.push({ ts, price });
    const cutoff = ts - this.windowSeconds * 1000;
    this.buffer = this.buffer.filter((p) => p.ts >= cutoff);
  }

  pctChangeSinceWindowStart(): number | null {
    if (this.buffer.length < 2) return null;
    const oldest = this.buffer[0]!;
    const newest = this.buffer[this.buffer.length - 1]!;
    return (newest.price - oldest.price) / oldest.price;
  }

  /** Raw price at the start of the current window — for building SignalPayload.pctBefore. */
  getOldestPrice(): number | null {
    return this.buffer[0]?.price ?? null;
  }

  /** Raw price of the most recent tick — for building SignalPayload.pctAfter. */
  getNewestPrice(): number | null {
    return this.buffer[this.buffer.length - 1]?.price ?? null;
  }
}
