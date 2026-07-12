"use client";

import { useState } from "react";
import type { TrackedFixtureRow } from "@/lib/types";
import { StatusDot } from "./StatusDot";
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
 * Live/Replay is a first-class toggle, never a hidden setting (both are
 * legitimate — the judging calendar means most demos happen in replay).
 * The toggle filters which fixtures are selectable: "Live" only offers
 * fixtures currently live, "Replay" offers everything else (scheduled or
 * finished) — never presented as a degraded mode.
 *
 * `mode`/`filteredFixtures` are owned by the page, not local state here —
 * the agent cards below the header need to react to the same filter,
 * otherwise switching to "Live" with no live match only changed the
 * dropdown while the rest of the page kept showing the last selected
 * finished fixture's data.
 */
export function Header({ filteredFixtures, selectedFixtureId, onSelectFixture, mode, onModeChange, usingMockData, wsConnected }: HeaderProps) {
  const selectedFixture = filteredFixtures.find((f) => f.fixtureId === selectedFixtureId);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <div>
          <h1 className="font-serif text-2xl leading-none text-ink">Sentinel Arena</h1>
          <p className="text-xs text-ink-muted">Two agents, the same data, verifiable proof</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTutorialOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:border-accent hover:text-accent"
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ backgroundColor: "var(--accent-flash)", color: "var(--accent)" }}
            aria-hidden
          >
            ?
          </span>
          How this works
        </button>

        {usingMockData ? (
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-muted">sample data (mock)</span>
        ) : (
          <span className="rounded-full border border-border bg-surface px-3 py-1.5">
            <StatusDot status={wsConnected ? "active" : "paused"} label={wsConnected ? "connected" : "reconnecting…"} />
          </span>
        )}

        <div className="flex items-center rounded-full border border-border bg-surface p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => onModeChange("live")}
            className={`rounded-full px-3 py-1.5 transition ${
              mode === "live" ? "bg-accent text-accent-ink" : "text-ink-secondary hover:text-ink"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {mode === "live" && <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent-ink" />}
              Live
            </span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("replay")}
            className={`rounded-full px-3 py-1.5 transition ${
              mode === "replay" ? "bg-accent text-accent-ink" : "text-ink-secondary hover:text-ink"
            }`}
          >
            Replay
          </button>
        </div>

        {filteredFixtures.length > 0 ? (
          <select
            value={selectedFixtureId ?? ""}
            onChange={(event) => onSelectFixture(Number(event.target.value))}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink"
          >
            {filteredFixtures.map((fixture) => (
              <option key={fixture.fixtureId} value={fixture.fixtureId}>
                {fixture.participant1} × {fixture.participant2}
                {fixture.competition ? ` · ${fixture.competition}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-muted">
            {mode === "live" ? "no live match right now" : "no recorded fixture yet"}
          </span>
        )}

        {selectedFixture && (
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-secondary">
            status: {selectedFixture.status === "live" ? "live" : selectedFixture.status === "finished" ? "finished" : "scheduled"}
          </span>
        )}
      </div>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </header>
  );
}

/**
 * Pixel-art shield-with-a-watching-eye — a sentinel keeping watch, not a
 * generic checkmark. Same blocky-rect grid technique as SquirrelMascot, for
 * visual consistency across the app's icon language.
 */
const LOGO_GRID = ["011111110", "111111111", "111111111", "110222011", "110222011", "111111111", "011111110", "001111100", "000111000"];

function LogoMark() {
  const unit = 2.6;
  const offsetX = 4;
  const offsetY = 3.5;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent)" />
      {LOGO_GRID.flatMap((row, y) =>
        row.split("").map((cell, x) => {
          if (cell === "0") return null;
          const fill = cell === "2" ? "var(--accent)" : "var(--accent-ink)";
          return (
            <rect
              key={`${x}-${y}`}
              x={offsetX + x * unit}
              y={offsetY + y * unit}
              width={unit}
              height={unit}
              fill={fill}
            />
          );
        }),
      )}
    </svg>
  );
}
