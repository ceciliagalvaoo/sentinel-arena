"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TrackedFixtureRow } from "@/lib/types";
import { drawMiniSquirrel } from "@/lib/arena-engine";
import { flagKeyForTeam, paintFlag } from "@/lib/flags";
import { TutorialModal } from "./TutorialModal";

export type Mode = "live" | "replay";

interface HeaderProps {
  filteredFixtures: TrackedFixtureRow[];
  selectedFixtureId: number | null;
  onSelectFixture: (fixtureId: number) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  usingMockData: boolean;
  wsConnected: boolean;
}

/**
 * Arcade header + scoreboard. Wordmark "SENTINEL ARENA" stays the primary
 * brand; "RUSH 'N SAGE" is the secondary mascot lockup. Nav routes to /
 * (ARENA) and /verify; HOW TO USE opens the tutorial. The scoreboard carries
 * the fixture selector, procedural flags, the LIVE/REPLAY toggle, and the
 * connection status — same mode/fixture semantics the page owns.
 */
export function Header({
  filteredFixtures,
  selectedFixtureId,
  onSelectFixture,
  mode,
  onModeChange,
  usingMockData,
  wsConnected,
}: HeaderProps) {
  const selectedFixture = filteredFixtures.find((f) => f.fixtureId === selectedFixtureId);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const rushMiniRef = useRef<HTMLCanvasElement>(null);
  const sageMiniRef = useRef<HTMLCanvasElement>(null);
  const homeFlagRef = useRef<HTMLCanvasElement>(null);
  const awayFlagRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (rushMiniRef.current) drawMiniSquirrel(rushMiniRef.current, "rush");
    if (sageMiniRef.current) drawMiniSquirrel(sageMiniRef.current, "sage");
  }, []);

  useEffect(() => {
    if (homeFlagRef.current) paintFlag(homeFlagRef.current, flagKeyForTeam(selectedFixture?.participant1));
    if (awayFlagRef.current) paintFlag(awayFlagRef.current, flagKeyForTeam(selectedFixture?.participant2));
  }, [selectedFixture?.participant1, selectedFixture?.participant2]);

  return (
    <header className="flex w-full flex-col items-center gap-4 text-center">
      <div className="text-[9px] tracking-[2px] text-accent">TXODDS WORLD CUP HACKATHON</div>
      <h1 className="arc-wordmark m-0 text-[clamp(16px,5.5vw,26px)] font-normal tracking-[2px] text-ink">SENTINEL ARENA</h1>
      <div className="text-[9px] leading-loose tracking-[1px] text-muted">TWO AGENTS, THE SAME DATA, VERIFIABLE PROOF</div>

      {/* Rush 'N Sage lockup — secondary mascot mark */}
      <div className="flex items-center gap-3 bg-panel px-3.5 py-1.5" style={{ boxShadow: "0 3px 0 var(--arc-shadow)" }}>
        <canvas ref={rushMiniRef} width={14} height={16} className="pixel-art block h-8 w-7" />
        <span className="text-[10px] tracking-[1px]">
          <span className="text-rush">RUSH</span>
          <span className="text-muted"> &apos;N </span>
          <span className="text-sage">SAGE</span>
        </span>
        <canvas ref={sageMiniRef} width={14} height={16} className="pixel-art block h-8 w-7" style={{ transform: "scaleX(-1)" }} />
      </div>

      <div className="animate-arcblink-fast text-[9px] text-good">● INSERT COIN — PICK A MODE BELOW</div>

      {/* Nav */}
      <nav className="flex flex-wrap justify-center gap-2.5">
        <Link href="/" className="arc-btn bg-accent px-4 py-2.5 text-[9px] text-accent-ink">
          ARENA
        </Link>
        <Link href="/verify" className="arc-btn bg-panel-raised px-4 py-2.5 text-[9px] text-ink">
          VERIFY PROOF
        </Link>
        <button type="button" onClick={() => setTutorialOpen(true)} className="arc-btn bg-panel-raised px-4 py-2.5 text-[9px] text-ink">
          ? HOW TO USE
        </button>
      </nav>

      {/* Scoreboard */}
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2.5 px-1 py-2 text-[10px]">
        {filteredFixtures.length > 0 ? (
          <select
            value={selectedFixtureId ?? ""}
            onChange={(e) => onSelectFixture(Number(e.target.value))}
            className="cursor-pointer bg-panel px-2.5 py-2 font-pixel text-[8px] text-ink outline-none"
          >
            {filteredFixtures.map((fixture) => (
              <option key={fixture.fixtureId} value={fixture.fixtureId}>
                {(fixture.participant1 ?? "TBD").toUpperCase()} × {(fixture.participant2 ?? "TBD").toUpperCase()}
                {fixture.competition ? ` · ${fixture.competition.toUpperCase()}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="bg-panel px-2.5 py-2 text-[8px] text-muted">
            {mode === "live" ? "NO LIVE MATCH RIGHT NOW" : "NO RECORDED FIXTURE YET"}
          </span>
        )}

        {selectedFixture && (
          <>
            <canvas ref={homeFlagRef} width={12} height={8} className="pixel-art block h-6 w-9" />
            <span className="text-ink">{(selectedFixture.participant1 ?? "TBD").toUpperCase()}</span>
            <span className="text-accent">VS</span>
            <span className="text-ink">{(selectedFixture.participant2 ?? "TBD").toUpperCase()}</span>
            <canvas ref={awayFlagRef} width={12} height={8} className="pixel-art block h-6 w-9" />
          </>
        )}

        <span className="h-[18px] w-0.5 bg-arcborder" />

        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onModeChange("live")}
            className={`arc-btn-flat px-3 py-2 text-[8px] ${mode === "live" ? "bg-accent text-accent-ink" : "bg-panel text-muted"}`}
          >
            LIVE
          </button>
          <button
            type="button"
            onClick={() => onModeChange("replay")}
            className={`arc-btn-flat px-3 py-2 text-[8px] ${mode === "replay" ? "bg-accent text-accent-ink" : "bg-panel text-muted"}`}
          >
            REPLAY
          </button>
        </div>

        {usingMockData ? (
          <span className="bg-panel px-2.5 py-2 text-[8px] text-muted">SAMPLE DATA (MOCK)</span>
        ) : mode === "live" ? (
          <span className="inline-flex items-center gap-1.5 text-[8px] text-good">
            <span className="h-1.5 w-1.5 animate-arcblink bg-good" />
            {wsConnected ? "LISTENING FOR ON-CHAIN COMMITS…" : "RECONNECTING…"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[8px] text-muted">
            <span className={`h-1.5 w-1.5 ${wsConnected ? "bg-good" : "bg-muted"}`} />
            {wsConnected ? "CONNECTED" : "OFFLINE"}
          </span>
        )}
      </div>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </header>
  );
}
