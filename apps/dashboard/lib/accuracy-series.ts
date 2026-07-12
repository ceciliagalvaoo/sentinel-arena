import type { AgentId, SignalWithLifecycle } from "./types";

export interface AccuracyPoint {
  ts: number;
  aggressive: number | null;
  conservative: number | null;
}

interface CumulativePoint {
  ts: number;
  value: number;
}

function cumulativeSeries(signals: SignalWithLifecycle[]): CumulativePoint[] {
  const graded = signals
    .filter((s) => s.grade !== null)
    .slice()
    .sort((a, b) => Date.parse(a.grade!.gradedAt) - Date.parse(b.grade!.gradedAt));

  let correct = 0;
  return graded.map((signal, index) => {
    if (signal.grade!.correct) correct += 1;
    return { ts: Date.parse(signal.grade!.gradedAt), value: correct / (index + 1) };
  });
}

/**
 * Merges both agents' cumulative-accuracy step functions onto one sorted
 * timeline (dataviz skill: one axis, series carried forward with
 * connectNulls rather than a dual-axis or re-sampled chart).
 */
export function buildComparisonSeries(signalsByAgent: Record<AgentId, SignalWithLifecycle[]>): AccuracyPoint[] {
  const aggressiveSeries = cumulativeSeries(signalsByAgent["agent-aggressive"] ?? []);
  const conservativeSeries = cumulativeSeries(signalsByAgent["agent-conservative"] ?? []);

  const allTimestamps = Array.from(new Set([...aggressiveSeries.map((p) => p.ts), ...conservativeSeries.map((p) => p.ts)])).sort(
    (a, b) => a - b,
  );

  let aggressiveIdx = -1;
  let conservativeIdx = -1;

  return allTimestamps.map((ts) => {
    while (aggressiveIdx + 1 < aggressiveSeries.length && aggressiveSeries[aggressiveIdx + 1]!.ts <= ts) aggressiveIdx++;
    while (conservativeIdx + 1 < conservativeSeries.length && conservativeSeries[conservativeIdx + 1]!.ts <= ts) conservativeIdx++;

    return {
      ts,
      aggressive: aggressiveIdx >= 0 ? aggressiveSeries[aggressiveIdx]!.value : null,
      conservative: conservativeIdx >= 0 ? conservativeSeries[conservativeIdx]!.value : null,
    };
  });
}
