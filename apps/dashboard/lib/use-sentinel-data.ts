"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentCardData, AgentId, SignalWithLifecycle, TrackedFixtureRow } from "./types";
import { fetchAgentAccuracy, fetchAgentBalance, fetchAgents, fetchFixtures, fetchSignals, wsUrl } from "./api";
import { mockAgentCards, mockFixture } from "./mock-data";

const AGENT_IDS: AgentId[] = ["agent-aggressive", "agent-conservative"];

export interface SentinelData {
  fixtures: TrackedFixtureRow[];
  selectedFixtureId: number | null;
  setSelectedFixtureId: (id: number) => void;
  agentCards: Record<AgentId, AgentCardData>;
  loading: boolean;
  /** True whenever apps/backend-api couldn't be reached — dashboard still works standalone on mock data. */
  usingMockData: boolean;
  wsConnected: boolean;
}

/**
 * Tries the real backend-api first; falls back to mock data on any failure
 * (network error, backend not running) so the dashboard is still usable for
 * pure UI work without the rest of the stack up. Once on real data, opens a
 * WebSocket for live signal-lifecycle pushes (architecture doc section 13).
 */
export function useSentinelData(): SentinelData {
  const [fixtures, setFixtures] = useState<TrackedFixtureRow[]>([mockFixture]);
  const [selectedFixtureId, setSelectedFixtureIdState] = useState<number | null>(mockFixture.fixtureId);
  const [agentCards, setAgentCards] = useState<Record<AgentId, AgentCardData>>(mockAgentCards);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const hasLoadedOnce = useRef(false);

  const loadAgentCard = useCallback(async (agentId: AgentId, fixtureId: number): Promise<AgentCardData> => {
    const [agents, accuracy, wallet, recentSignals] = await Promise.all([
      fetchAgents(),
      fetchAgentAccuracy(agentId),
      fetchAgentBalance(agentId),
      fetchSignals({ agentId, fixtureId, limit: 50 }),
    ]);
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found in /api/agents response`);
    return { agent, accuracy, wallet, status: wallet.status, recentSignals };
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const fetchedFixtures = await fetchFixtures();
        if (fetchedFixtures.length === 0) throw new Error("backend-api returned no tracked fixtures");

        const liveFixture = fetchedFixtures.find((f) => f.status === "live");
        const defaultFixture = liveFixture ?? fetchedFixtures[0]!;

        const [aggressiveCard, conservativeCard] = await Promise.all([
          loadAgentCard("agent-aggressive", defaultFixture.fixtureId),
          loadAgentCard("agent-conservative", defaultFixture.fixtureId),
        ]);

        if (cancelled) return;
        setFixtures(fetchedFixtures);
        setSelectedFixtureIdState(defaultFixture.fixtureId);
        setAgentCards({ "agent-aggressive": aggressiveCard, "agent-conservative": conservativeCard });
        setUsingMockData(false);
        hasLoadedOnce.current = true;
      } catch (err) {
        console.warn("[sentinel] backend-api unreachable, falling back to mock data", err);
        if (!cancelled) setUsingMockData(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [loadAgentCard]);

  // Refetch when the user picks a different fixture (skips the run that coincides with initial load)
  useEffect(() => {
    if (usingMockData || selectedFixtureId === null || !hasLoadedOnce.current) return;
    let cancelled = false;

    Promise.all(AGENT_IDS.map((id) => loadAgentCard(id, selectedFixtureId)))
      .then(([aggressiveCard, conservativeCard]) => {
        if (cancelled) return;
        setAgentCards({ "agent-aggressive": aggressiveCard, "agent-conservative": conservativeCard });
      })
      .catch((err) => console.warn("[sentinel] failed to reload signals for the selected fixture", err));

    return () => {
      cancelled = true;
    };
  }, [selectedFixtureId, usingMockData, loadAgentCard]);

  // Live WebSocket updates -- reconnects with exponential backoff (capped at
  // 30s, same pattern as the agents' own SSE reconnect in
  // packages/agent-runtime) so a Render free-tier cold-start/restart while
  // someone is watching doesn't leave the dashboard stuck until a manual
  // refresh; the underlying signal pipeline never depends on this socket,
  // it only affects how fast the UI reflects what's already in the DB.
  useEffect(() => {
    if (usingMockData) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function connect() {
      if (cancelled) return;
      socket = new WebSocket(wsUrl());

      socket.onopen = () => {
        attempt = 0;
        setWsConnected(true);
      };

      socket.onclose = () => {
        setWsConnected(false);
        if (cancelled) return;
        const delay = Math.min(1000 * 2 ** attempt, 30_000);
        attempt++;
        reconnectTimer = setTimeout(connect, delay);
      };

      // A WebSocket always fires close right after error, so scheduling the
      // reconnect in onclose above is enough -- this only avoids leaving a
      // half-open socket lingering while that close event is pending.
      socket.onerror = () => socket?.close();

      socket.onmessage = (event) => {
        let message: { type: string; signals: SignalWithLifecycle[] };
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type !== "signals_updated") return;

        setAgentCards((prev) => {
          const next = { ...prev };
          for (const signal of message.signals) {
            if (signal.fixtureId !== selectedFixtureId) continue;
            const existing = next[signal.agentId];
            if (!existing) continue;
            const withoutStale = existing.recentSignals.filter((s) => s.id !== signal.id);
            next[signal.agentId] = { ...existing, recentSignals: [signal, ...withoutStale] };
          }
          return next;
        });

        const affectedAgents = new Set(message.signals.map((s) => s.agentId));
        affectedAgents.forEach((agentId) => {
          fetchAgentAccuracy(agentId)
            .then((accuracy) =>
              setAgentCards((prev) => (prev[agentId] ? { ...prev, [agentId]: { ...prev[agentId], accuracy } } : prev)),
            )
            .catch(() => undefined);
        });
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [usingMockData, selectedFixtureId]);

  return {
    fixtures,
    selectedFixtureId,
    setSelectedFixtureId: setSelectedFixtureIdState,
    agentCards,
    loading,
    usingMockData,
    wsConnected,
  };
}
