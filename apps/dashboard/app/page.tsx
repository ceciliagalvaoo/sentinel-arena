"use client";

import { useEffect, useMemo, useState } from "react";
import { Header, type Mode } from "@/components/Header";
import { AgentCard } from "@/components/AgentCard";
import { ComparisonChart } from "@/components/ComparisonChart";
import { Footer } from "@/components/Footer";
import { useSentinelData } from "@/lib/use-sentinel-data";
import { useFullSignals } from "@/lib/use-full-signals";
import { useReplayAnimation } from "@/lib/use-replay-animation";
import { buildComparisonSeries } from "@/lib/accuracy-series";
import { mockAgentCards } from "@/lib/mock-data";
import type { AgentId, SignalWithLifecycle } from "@/lib/types";

export default function DashboardPage() {
  const { fixtures, selectedFixtureId, setSelectedFixtureId, agentCards, loading, usingMockData, wsConnected } = useSentinelData();

  const [mode, setMode] = useState<Mode>("replay");

  const filteredFixtures = useMemo(
    () => fixtures.filter((f) => (mode === "live" ? f.status === "live" : f.status !== "live")),
    [fixtures, mode],
  );

  // Same filter the header's dropdown uses — if the currently selected
  // fixture doesn't belong to this mode (e.g. it's finished, but the user
  // just switched to "Live"), there is nothing to show: never fall back
  // to displaying a stale, unrelated fixture's data.
  const selectedFixture = filteredFixtures.find((f) => f.fixtureId === selectedFixtureId) ?? null;

  // When switching modes (or once fixtures load), snap the selection to the
  // first fixture that's actually valid in the new mode, so the dropdown and
  // the cards below never disagree about what's selected.
  useEffect(() => {
    if (filteredFixtures.length === 0) return;
    if (filteredFixtures.some((f) => f.fixtureId === selectedFixtureId)) return;
    setSelectedFixtureId(filteredFixtures[0]!.fixtureId);
  }, [mode, filteredFixtures, selectedFixtureId, setSelectedFixtureId]);

  // A finished fixture doesn't keep producing new events on its own — without
  // this, a judge opening the dashboard after the agents already stopped
  // would just see a frozen final state. In replay mode against a finished
  // fixture, replay the real (already on-chain) history as an animation
  // instead of showing it all at once — see use-replay-animation.ts.
  const isReplayShowcase = mode === "replay" && selectedFixture !== null && selectedFixture.status === "finished";

  const { fullSignals } = useFullSignals(usingMockData ? null : (selectedFixture?.fixtureId ?? null), isReplayShowcase && !usingMockData);

  const showcaseSource: Record<AgentId, SignalWithLifecycle[]> = usingMockData
    ? { "agent-aggressive": mockAgentCards["agent-aggressive"].recentSignals, "agent-conservative": mockAgentCards["agent-conservative"].recentSignals }
    : fullSignals;

  const replay = useReplayAnimation(showcaseSource, isReplayShowcase);

  const aggressiveCard = isReplayShowcase
    ? { ...agentCards["agent-aggressive"], recentSignals: replay.visibleSignals["agent-aggressive"], accuracy: replay.accuracy["agent-aggressive"] }
    : agentCards["agent-aggressive"];
  const conservativeCard = isReplayShowcase
    ? { ...agentCards["agent-conservative"], recentSignals: replay.visibleSignals["agent-conservative"], accuracy: replay.accuracy["agent-conservative"] }
    : agentCards["agent-conservative"];

  const comparisonData = buildComparisonSeries({
    "agent-aggressive": aggressiveCard.recentSignals,
    "agent-conservative": conservativeCard.recentSignals,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-8">
      <Header
        filteredFixtures={filteredFixtures}
        selectedFixtureId={selectedFixtureId}
        onSelectFixture={setSelectedFixtureId}
        mode={mode}
        onModeChange={setMode}
        usingMockData={usingMockData}
        wsConnected={wsConnected}
      />

      {selectedFixture && selectedFixture.status === "finished" && !selectedFixture.capturedLive && (
        <div className="rounded-xl2 border border-dashed border-border bg-surface px-4 py-2.5 text-center text-xs text-ink-muted">
          This match's data was reconstructed from TxLINE's historical record after the fact, not captured live tick-by-tick —
          every hash and result below is real and on-chain, but the timestamps shown reflect when we processed this replay, not
          the original match time.
        </div>
      )}

      {isReplayShowcase && replay.hasHistory && (
        <div className="flex items-center justify-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3 text-xs text-ink-secondary">
          {replay.isComplete ? (
            <>
              <span>Replay complete — this match's entire real history is now on screen.</span>
              <button
                type="button"
                onClick={replay.restart}
                className="rounded-full border border-border bg-surface-raised px-3 py-1.5 font-medium text-ink transition hover:bg-accent hover:text-accent-ink"
              >
                ▶ watch again
              </button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                Replaying this match's real history — the hashes and results already happened on-chain.
              </span>
              <button
                type="button"
                onClick={replay.skipToEnd}
                className="rounded-full border border-border bg-surface-raised px-3 py-1.5 font-medium text-ink transition hover:bg-accent hover:text-accent-ink"
              >
                skip to the end →
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : !selectedFixture ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface py-16 text-center">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-ink-muted" />
          <p className="text-sm text-ink-secondary">
            {mode === "live" ? "No live match right now." : "No recorded fixture for replay yet."}
          </p>
          <p className="text-xs text-ink-muted">
            {mode === "live" ? "The agents keep listening to the stream — as soon as a match starts, it shows up here." : "Record a fixture with scripts/seed-replay-data.ts."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AgentCard
              data={aggressiveCard}
              variant="aggressive"
              displayName="Agent-Aggressive"
              tagline="k=1.5 · reacts fast to any move"
              participant1={selectedFixture?.participant1}
              participant2={selectedFixture?.participant2}
            />
            <AgentCard
              data={conservativeCard}
              variant="conservative"
              displayName="Agent-Conservative"
              tagline="k=3.0 · only moves on strong signals"
              participant1={selectedFixture?.participant1}
              participant2={selectedFixture?.participant2}
            />
          </div>

          <ComparisonChart data={comparisonData} />
        </>
      )}

      <Footer />
    </main>
  );
}
