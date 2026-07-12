"use client";

import { useEffect, useState } from "react";
import type { AgentId, SignalWithLifecycle } from "./types";
import { fetchSignals } from "./api";

const AGENT_IDS: AgentId[] = ["agent-aggressive", "agent-conservative"];
// Comfortably above any real match's signal count (largest observed this
// project: a few hundred per agent for a full 90+ min match) — the replay
// showcase needs the WHOLE history, not the capped 50 the live feed uses.
const FULL_HISTORY_LIMIT = 5000;

const EMPTY: Record<AgentId, SignalWithLifecycle[]> = { "agent-aggressive": [], "agent-conservative": [] };

/** Fetches every signal (both agents) for one fixture — used only to feed the replay showcase animation, never the live view. */
export function useFullSignals(fixtureId: number | null, enabled: boolean): { fullSignals: Record<AgentId, SignalWithLifecycle[]>; loading: boolean } {
  const [fullSignals, setFullSignals] = useState<Record<AgentId, SignalWithLifecycle[]>>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || fixtureId === null) {
      setFullSignals(EMPTY);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all(AGENT_IDS.map((agentId) => fetchSignals({ agentId, fixtureId, limit: FULL_HISTORY_LIMIT })))
      .then(([aggressive, conservative]) => {
        if (cancelled) return;
        setFullSignals({ "agent-aggressive": aggressive, "agent-conservative": conservative });
      })
      .catch((err) => console.warn("[sentinel] failed to fetch full replay history", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fixtureId, enabled]);

  return { fullSignals, loading };
}
