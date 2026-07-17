"use client";

import { useEffect, useMemo, useState } from "react";
import { Header, type Mode } from "@/components/Header";
import { ArenaScene } from "@/components/ArenaScene";
import { AgentCard } from "@/components/AgentCard";
import { ComparisonChart } from "@/components/ComparisonChart";
import { Footer } from "@/components/Footer";
import { useSentinelData } from "@/lib/use-sentinel-data";
import { useFullSignals } from "@/lib/use-full-signals";
import { useReplayAnimation } from "@/lib/use-replay-animation";
import { mockAgentCards } from "@/lib/mock-data";
import type { AgentId, SignalWithLifecycle } from "@/lib/types";

export default function DashboardPage() {
  const { fixtures, selectedFixtureId, setSelectedFixtureId, agentCards, loading, usingMockData, wsConnected } = useSentinelData();

  const [mode, setMode] = useState<Mode>("replay");

  // This is a World Cup product. Once the tournament is over the live TxLINE
  // feed also carries other competitions (friendlies, leagues, ...), and the
  // agents register any soccer fixture they see odds for. Those must never leak
  // into the dashboard, so every fixture is filtered to the World Cup before
  // the mode filter runs. (Frontend-only guard; nothing on the backend changes.)
  const filteredFixtures = useMemo(
    () =>
      fixtures
        .filter((f) => (f.competition ?? "").toLowerCase().includes("world cup"))
        .filter((f) => (mode === "live" ? f.status === "live" : f.status !== "live")),
    [fixtures, mode],
  );

  const selectedFixture = filteredFixtures.find((f) => f.fixtureId === selectedFixtureId) ?? null;

  // Snap the selection to a fixture valid in the current mode so the dropdown
  // and the cards below never disagree about what's selected.
  useEffect(() => {
    if (filteredFixtures.length === 0) return;
    if (filteredFixtures.some((f) => f.fixtureId === selectedFixtureId)) return;
    setSelectedFixtureId(filteredFixtures[0]!.fixtureId);
  }, [mode, filteredFixtures, selectedFixtureId, setSelectedFixtureId]);

  // A finished fixture stops producing events — replay its real (already
  // on-chain) history as a timed animation so there's always something to watch.
  const isReplayShowcase = mode === "replay" && selectedFixture !== null && selectedFixture.status === "finished";

  const { fullSignals } = useFullSignals(usingMockData ? null : selectedFixture?.fixtureId ?? null, isReplayShowcase && !usingMockData);

  // MUST be memoized: this is the input to useReplayAnimation, whose internal
  // scheduling memos (and the effect that drives elapsed time) key off its
  // identity. A fresh object every render would reset the replay to t=0 on
  // every render — which silently breaks playback AND "skip to end" (the skip
  // sets the clock to the end, the next render's new object resets it to 0).
  const showcaseSource = useMemo<Record<AgentId, SignalWithLifecycle[]>>(
    () =>
      usingMockData
        ? {
            "agent-aggressive": mockAgentCards["agent-aggressive"].recentSignals,
            "agent-conservative": mockAgentCards["agent-conservative"].recentSignals,
          }
        : fullSignals,
    [usingMockData, fullSignals],
  );

  const replay = useReplayAnimation(showcaseSource, isReplayShowcase);

  const aggressiveCard = isReplayShowcase
    ? { ...agentCards["agent-aggressive"], recentSignals: replay.visibleSignals["agent-aggressive"], accuracy: replay.accuracy["agent-aggressive"] }
    : agentCards["agent-aggressive"];
  const conservativeCard = isReplayShowcase
    ? { ...agentCards["agent-conservative"], recentSignals: replay.visibleSignals["agent-conservative"], accuracy: replay.accuracy["agent-conservative"] }
    : agentCards["agent-conservative"];

  // Rush = aggressive, Sage = conservative.
  const rushSignals = aggressiveCard.recentSignals;
  const sageSignals = conservativeCard.recentSignals;

  // The KO fires once the replay showcase finishes (the winner throws the punch).
  const koTrigger = isReplayShowcase && replay.hasHistory && replay.isComplete;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[960px] flex-col items-center gap-6 px-3 pb-16 pt-7">
      <Header
        filteredFixtures={filteredFixtures}
        selectedFixtureId={selectedFixtureId}
        onSelectFixture={setSelectedFixtureId}
        mode={mode}
        onModeChange={setMode}
        usingMockData={usingMockData}
        wsConnected={wsConnected}
      />

      {/* `capturedLive` isn't reliable for this anymore: the periodic backfill
          sweep (findFixturesNeedingReplayBackfill, ~6h after any match ends)
          flips it to false on EVERY old finished fixture to populate
          recorded_events for audit purposes, whether or not that fixture was
          actually captured live at the time. France v Morocco (18209181) is
          the one match genuinely fed through ReplayDataSource after the fact
          (README's validation run, before the agents were live-streaming) —
          Spain/Argentina and England/France were both captured live tick-by-
          tick, they just got the same audit flag flipped incidentally once
          they aged past 6h. Anchor on the fixture, not the flag. */}
      {selectedFixture && selectedFixture.fixtureId === 18209181 && (
        <div className="w-full max-w-[920px] bg-panel-row px-4 py-2.5 text-center text-[8px] leading-loose text-muted">
          THIS MATCH&apos;S DATA WAS RECONSTRUCTED FROM TXLINE&apos;S HISTORICAL RECORD AFTER THE FACT, NOT CAPTURED LIVE TICK-BY-TICK —
          EVERY HASH AND RESULT BELOW IS REAL AND ON-CHAIN, BUT THE TIMESTAMPS REFLECT WHEN WE PROCESSED THIS REPLAY.
        </div>
      )}

      {/* England v Argentina, 2026-07-15 — both agents' VMs went down mid-match
          (aggressive: OOM; conservative: a network stall with no timeout wedged
          its event loop). No signal exists for that window on either agent and
          none was reconstructed after the fact — a signal committed once the
          result is knowable would defeat the whole point of this project. See
          the Production Readiness docs for the full incident writeup. */}
      {selectedFixture && selectedFixture.fixtureId === 18241006 && (
        <div className="w-full max-w-[920px] bg-panel-row px-4 py-2.5 text-center text-[8px] leading-loose text-muted">
          BOTH AGENTS LOST CONNECTIVITY DURING THIS MATCH, FROM ~16:35 TO ~19:27 UTC (~13:35 TO ~16:27 BRT) — A REAL INFRASTRUCTURE
          INCIDENT, NOT A DATA ISSUE (SEE PRODUCTION READINESS DOCS). NO SIGNAL EXISTS FOR THAT WINDOW ON EITHER AGENT, AND NONE WAS
          ADDED AFTER THE FACT. EVERYTHING ELSE SHOWN HERE IS REAL AND ON-CHAIN.
        </div>
      )}

      {isReplayShowcase && replay.hasHistory && (
        <div className="flex w-full max-w-[920px] flex-wrap items-center justify-center gap-3 bg-panel-row px-4 py-3 text-[8px] text-ink-soft">
          {replay.isComplete ? (
            <>
              <span>REPLAY COMPLETE — THIS MATCH&apos;S ENTIRE REAL HISTORY IS ON SCREEN.</span>
              <button type="button" onClick={replay.restart} className="arc-btn-sm bg-good px-2.5 py-2 text-[8px] text-bg-deep">
                ▶ WATCH AGAIN
              </button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-arcblink bg-accent" />
                REPLAYING THIS MATCH&apos;S REAL HISTORY — THE HASHES AND RESULTS ALREADY HAPPENED ON-CHAIN.
              </span>
              <button type="button" onClick={replay.skipToEnd} className="arc-btn-sm bg-accent px-2.5 py-2 text-[8px] text-accent-ink">
                ⏭ SKIP TO END
              </button>
            </>
          )}
        </div>
      )}

      {/* The arena is always on screen — idle squirrels when there's nothing to react to. */}
      <ArenaScene
        rushSignals={rushSignals}
        sageSignals={sageSignals}
        rushAccuracy={aggressiveCard.accuracy.accuracy}
        sageAccuracy={conservativeCard.accuracy.accuracy}
        koTrigger={koTrigger}
      />

      {loading ? (
        <p className="text-[9px] text-muted">LOADING…</p>
      ) : !selectedFixture ? (
        <div className="flex w-full max-w-[920px] flex-col items-center gap-2 bg-panel-soft py-14 text-center">
          <span className="h-2 w-2 animate-arcblink bg-muted" />
          <p className="text-[9px] text-ink-soft">{mode === "live" ? "NO LIVE MATCH RIGHT NOW." : "NO RECORDED FIXTURE FOR REPLAY YET."}</p>
          <p className="text-[8px] text-muted">
            {mode === "live" ? "THE AGENTS KEEP LISTENING — A MATCH SHOWS UP HERE AS SOON AS IT STARTS." : "RECORD A FIXTURE WITH scripts/seed-replay-data.ts."}
          </p>
        </div>
      ) : (
        <>
          <section className="grid w-full max-w-[920px] grid-cols-1 gap-4 md:grid-cols-2">
            <AgentCard
              data={aggressiveCard}
              variant="rush"
              displayName="RUSH"
              tagline="THE AGGRESSIVE AGENT · k=1.5 · REACTS FAST TO ANY MOVE"
              participant1={selectedFixture.participant1}
              participant2={selectedFixture.participant2}
              accuracyScope={isReplayShowcase ? "this-match" : "all-matches"}
            />
            <AgentCard
              data={conservativeCard}
              variant="sage"
              displayName="SAGE"
              tagline="THE CONSERVATIVE AGENT · k=3.0 · ONLY MOVES ON STRONG SIGNALS"
              participant1={selectedFixture.participant1}
              participant2={selectedFixture.participant2}
              accuracyScope={isReplayShowcase ? "this-match" : "all-matches"}
            />
          </section>

          <ComparisonChart rushSignals={rushSignals} sageSignals={sageSignals} />
        </>
      )}

      <Footer />
    </main>
  );
}
