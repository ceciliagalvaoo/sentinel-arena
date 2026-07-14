"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentAccuracy, AgentId, SignalWithLifecycle } from "./types";

const AGENT_IDS: AgentId[] = ["agent-aggressive", "agent-conservative"];

/** How long the whole replay takes to play out, regardless of how long the real match's odds window actually spanned. */
const ANIMATION_DURATION_MS = 45_000;
const TICK_MS = 200;
/**
 * Commits stream across this fraction of the run (leaving the tail for the
 * last reveals + the end-of-round KO), then each signal reveals REVEAL_LAG_MS
 * later. This is the ONLY synthetic part of the replay: the pacing. The real
 * detection ORDER and relative spacing are preserved (appearAtMs is normalised
 * over the real detection window), and every hash, result and grade shown is
 * the untouched on-chain data. Reveal timestamps are NOT replayed literally on
 * purpose — a real match reveals hours after commit, which would compress every
 * commit into the first blink and leave a long dead middle (the arcade demo
 * needs the squirrels reacting throughout, not once at the very end).
 */
const APPEAR_WINDOW = 0.78;
const REVEAL_LAG_MS = 6_000;

interface ScheduledSignal {
  signal: SignalWithLifecycle;
  appearAtMs: number;
  revealAtMs: number | null; // null when the signal was never revealed in the real run — stays "pending" forever here too
}

function scheduleSignals(signals: SignalWithLifecycle[], tMinDet: number, detSpanMs: number): ScheduledSignal[] {
  return signals.map((signal) => {
    const detectedAt = Date.parse(signal.detectedAt);
    const appearAtMs = ((detectedAt - tMinDet) / detSpanMs) * (APPEAR_WINDOW * ANIMATION_DURATION_MS);
    return {
      signal,
      appearAtMs,
      revealAtMs: signal.reveal ? Math.min(appearAtMs + REVEAL_LAG_MS, ANIMATION_DURATION_MS) : null,
    };
  });
}

function deriveAccuracy(agentId: string, visible: SignalWithLifecycle[]): AgentAccuracy {
  const graded = visible.filter((s) => s.grade !== null);
  const correct = graded.filter((s) => s.grade!.correct).length;
  return {
    agentId,
    correctSignals: correct,
    totalGradedSignals: graded.length,
    accuracy: graded.length === 0 ? 0 : correct / graded.length,
    // Computed over every graded signal CURRENTLY visible in the animation, same
    // full-set discipline as the real backend aggregate (never a capped sample) —
    // sentinel-dashboard-dev principle #4.
    allValidationChecked: graded.length > 0 && graded.every((s) => s.grade!.validationProofChecked),
  };
}

export interface ReplayAnimationResult {
  visibleSignals: Record<AgentId, SignalWithLifecycle[]>;
  accuracy: Record<AgentId, AgentAccuracy>;
  isComplete: boolean;
  hasHistory: boolean;
  skipToEnd: () => void;
  restart: () => void;
}

/**
 * Purely presentational replay of a finished fixture's ALREADY-real signal
 * history (every hash, timestamp and grade here already happened on-chain)
 * — no new backend or Solana work happens in this hook. A finished fixture
 * doesn't keep producing new events on its own, so without this a judge
 * opening the dashboard after the agents stopped would just see a frozen
 * final state with nothing to watch. This re-plays the real
 * detectedAt/revealedAt timestamps, compressed into ANIMATION_DURATION_MS,
 * so the SIGNAL → COMMIT → REVEAL progression is visible no matter when
 * someone opens the page — repeatable for every visitor, zero devnet cost.
 */
export function useReplayAnimation(fullSignalsByAgent: Record<AgentId, SignalWithLifecycle[]>, active: boolean): ReplayAnimationResult {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [runToken, setRunToken] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A signal without a commit never actually reached the chain — usually the
  // orphaned-signal integrity guard correctly refusing to back-commit after
  // a fixture was already graded (architecture doc section 6.2/"never commit
  // after the result is known"). Real and honest, but it has no commit/reveal
  // to animate and would sit as an unresolved "em andamento" row forever, so
  // the showcase excludes it — it's still fully visible via the API/DB for
  // anyone auditing, just not part of this curated replay.
  const committedByAgent = useMemo(() => {
    const result = {} as Record<AgentId, SignalWithLifecycle[]>;
    for (const id of AGENT_IDS) result[id] = (fullSignalsByAgent[id] ?? []).filter((s) => s.commit !== null);
    return result;
  }, [fullSignalsByAgent]);

  const hasHistory = AGENT_IDS.some((id) => (committedByAgent[id]?.length ?? 0) > 0);

  const scheduled = useMemo(() => {
    if (!hasHistory) return {} as Record<AgentId, ScheduledSignal[]>;
    const all = AGENT_IDS.flatMap((id) => committedByAgent[id] ?? []);
    // Normalise over the real DETECTION window only (not detection→reveal) so
    // commits keep their real cadence and stream across the run — see
    // scheduleSignals / APPEAR_WINDOW above for why reveals aren't literal.
    const tMin = Math.min(...all.map((s) => Date.parse(s.detectedAt)));
    const tMax = Math.max(...all.map((s) => Date.parse(s.detectedAt)));
    const spanMs = Math.max(tMax - tMin, 1);
    const result = {} as Record<AgentId, ScheduledSignal[]>;
    for (const id of AGENT_IDS) result[id] = scheduleSignals(committedByAgent[id] ?? [], tMin, spanMs);
    return result;
  }, [committedByAgent, hasHistory]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!active || !hasHistory) {
      setElapsedMs(0);
      return;
    }
    setElapsedMs(0);
    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= ANIMATION_DURATION_MS) {
        setElapsedMs(ANIMATION_DURATION_MS);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      setElapsedMs(elapsed);
    }, TICK_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, hasHistory, scheduled, runToken]);

  const visibleSignals = useMemo(() => {
    const result = {} as Record<AgentId, SignalWithLifecycle[]>;
    for (const id of AGENT_IDS) {
      result[id] = (scheduled[id] ?? [])
        .filter((s) => s.appearAtMs <= elapsedMs)
        .map((s) => {
          const revealed = s.revealAtMs !== null && s.revealAtMs <= elapsedMs;
          // The real reveal/grade already exist in the data — just hidden until
          // their scheduled moment, so the progression isn't spoiled up front.
          return revealed ? s.signal : { ...s.signal, reveal: null, grade: null };
        })
        .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
    }
    return result;
  }, [scheduled, elapsedMs]);

  const accuracy = useMemo(() => {
    const result = {} as Record<AgentId, AgentAccuracy>;
    for (const id of AGENT_IDS) result[id] = deriveAccuracy(id, visibleSignals[id] ?? []);
    return result;
  }, [visibleSignals]);

  return {
    visibleSignals,
    accuracy,
    isComplete: elapsedMs >= ANIMATION_DURATION_MS,
    hasHistory,
    skipToEnd: () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsedMs(ANIMATION_DURATION_MS);
    },
    restart: () => setRunToken((t) => t + 1),
  };
}
