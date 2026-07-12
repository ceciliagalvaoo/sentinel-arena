import { AutoCalibratedThreshold } from "./threshold.js";
import { SlidingOddsWindow } from "./window.js";

/**
 * All per-fixture agent state lives here, keyed from day one (architecture
 * doc section 2.3) — never assume a single active fixture. The key is a
 * string rather than a bare fixtureId because a fixture has multiple
 * independent outcomes (e.g. "part1"/"draw"/"part2"), each needing its own
 * window/threshold — callers compose the key as `${fixtureId}:${outcomeKey}`
 * (see market.ts). This is still exactly one Map per concern, just with a
 * richer key than the doc's simplified example — the principle (indexed
 * state, never a single global) is unchanged.
 */
export class MultiFixtureAgentState {
  private windows = new Map<string, SlidingOddsWindow>();
  private thresholds = new Map<string, AutoCalibratedThreshold>();

  getOrCreateWindow(trackingKey: string, windowSeconds: number): SlidingOddsWindow {
    let window = this.windows.get(trackingKey);
    if (!window) {
      window = new SlidingOddsWindow(windowSeconds);
      this.windows.set(trackingKey, window);
    }
    return window;
  }

  getOrCreateThreshold(trackingKey: string, warmupReadings: number, sensitivityMultiplier: number): AutoCalibratedThreshold {
    let threshold = this.thresholds.get(trackingKey);
    if (!threshold) {
      threshold = new AutoCalibratedThreshold(warmupReadings, sensitivityMultiplier);
      this.thresholds.set(trackingKey, threshold);
    }
    return threshold;
  }
}
