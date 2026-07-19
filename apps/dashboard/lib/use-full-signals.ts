"use client";

import { useEffect, useState } from "react";
import type { AgentId, SignalWithLifecycle } from "./types";
import { fetchSignals } from "./api";

const AGENT_IDS: AgentId[] = ["agent-aggressive", "agent-conservative"];
// A pre-match window spanning several days before kickoff (agents track a
// fixture from the moment TxLINE starts quoting it, not just from kickoff)
// pushed a real match past the old 5,000 cap — agent-aggressive alone hit
// 5,750 signals on the Spain x Argentina fixture (2026-07-19), silently
// truncating everything detected before the cutoff, pre-match history and
// all, out of both the replay showcase and the accuracy chart. Comfortably
// above that observed real maximum, not the few-hundred-per-90-minutes
// figure a match with no multi-day pre-match tracking would produce.
const FULL_HISTORY_LIMIT = 10_000;

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
