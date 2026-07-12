/**
 * The trigger threshold is never a human-picked constant (architecture doc
 * section 6.0) — it's calibrated per fixture from the volatility the agent
 * itself observes during a warmup window. The only human-chosen parameter is
 * `sensitivityMultiplier` (k): 1.5 for agent-aggressive, 3.0 for
 * agent-conservative. That's a strategy choice, not an "alarm tuning" knob —
 * never add a way to override the computed threshold directly.
 */
export class AutoCalibratedThreshold {
  private readings: number[] = [];
  private calibratedThreshold: number | null = null;

  constructor(
    private readonly warmupReadings: number,
    private readonly sensitivityMultiplier: number,
  ) {}

  observe(pctChangeSample: number): void {
    if (this.calibratedThreshold !== null) return; // already calibrated, never recalculated
    this.readings.push(pctChangeSample);
    if (this.readings.length >= this.warmupReadings) {
      this.calibratedThreshold = this.computeThreshold();
    }
  }

  private computeThreshold(): number {
    const mean = this.readings.reduce((a, b) => a + b, 0) / this.readings.length;
    const variance = this.readings.reduce((acc, v) => acc + (v - mean) ** 2, 0) / this.readings.length;
    const stdDev = Math.sqrt(variance);
    return mean + this.sensitivityMultiplier * stdDev;
  }

  isReady(): boolean {
    return this.calibratedThreshold !== null;
  }

  getThreshold(): number {
    if (this.calibratedThreshold === null) {
      throw new Error("Threshold ainda não calibrado — aguardando warmup");
    }
    return this.calibratedThreshold;
  }
}
