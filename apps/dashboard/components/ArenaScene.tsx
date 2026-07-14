"use client";

import { useEffect, useRef } from "react";
import { ArenaEngine, type ActorName } from "@/lib/arena-engine";
import type { SignalWithLifecycle } from "@/lib/types";

interface ArenaSceneProps {
  /** Rush = agent-aggressive's signals, newest first. */
  rushSignals: SignalWithLifecycle[];
  /** Sage = agent-conservative's signals, newest first. */
  sageSignals: SignalWithLifecycle[];
  /** 0..1 — decides who throws the finishing punch when `koTrigger` fires. */
  rushAccuracy: number;
  sageAccuracy: number;
  /** Rising edge (false→true) starts the end-of-round KO sequence once. */
  koTrigger: boolean;
  fps?: number;
  bob?: boolean;
  scanlines?: boolean;
}

/** Diffs one agent's signal list against the previous render and fires the
 * matching squirrel reaction: a fresh commit → eat, a correct grade → hop, an
 * incorrect grade → sad. Same detection AgentCard uses for its mascot mood. */
function useReactions(engine: ArenaEngine | null, name: ActorName, signals: SignalWithLifecycle[]): void {
  const prevLatest = useRef<string | undefined>(undefined);
  const prevGraded = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    const graded = signals.filter((s) => s.grade !== null);
    const latest = signals[0]?.id;

    // Seed on first run so opening the page mid-history doesn't fire a burst.
    if (!initialized.current) {
      initialized.current = true;
      prevGraded.current = new Set(graded.map((s) => s.id));
      prevLatest.current = latest;
      return;
    }

    const newlyGraded = graded.find((s) => !prevGraded.current.has(s.id));
    prevGraded.current = new Set(graded.map((s) => s.id));

    if (engine && newlyGraded) {
      engine.react(name, newlyGraded.grade!.correct ? "hop" : "sad");
      prevLatest.current = latest;
      return;
    }
    if (engine && latest && latest !== prevLatest.current) {
      engine.react(name, "eat");
    }
    prevLatest.current = latest;
  }, [engine, name, signals]);
}

/**
 * The arcade scene: two pixel squirrels (Rush left, Sage right) reacting to the
 * live/replayed signal feed on a single <canvas>. Replaces the old per-card
 * SquirrelMascot. The heavy lifting lives in ArenaEngine (lib/arena-engine.ts);
 * this component only owns the canvas, the rAF lifecycle, and the mapping from
 * React data → engine calls.
 */
export function ArenaScene({
  rushSignals,
  sageSignals,
  rushAccuracy,
  sageAccuracy,
  koTrigger,
  fps = 6,
  bob = true,
  scanlines = true,
}: ArenaSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ArenaEngine | null>(null);
  // Live prop mirrors the engine reads each frame via its getters.
  const fpsRef = useRef(fps);
  const bobRef = useRef(bob);
  fpsRef.current = fps;
  bobRef.current = bob;

  if (engineRef.current === null && typeof window !== "undefined") {
    engineRef.current = new ArenaEngine({ fps: () => fpsRef.current, bob: () => bobRef.current });
  }

  useEffect(() => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    engine.start(canvas);
    return () => engine.stop();
  }, []);

  useReactions(engineRef.current, "rush", rushSignals);
  useReactions(engineRef.current, "sage", sageSignals);

  // End-of-round KO — fire once on the rising edge of koTrigger.
  const prevKo = useRef(false);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (koTrigger && !prevKo.current) {
      const winner: ActorName = rushAccuracy >= sageAccuracy ? "rush" : "sage";
      const loser: ActorName = winner === "rush" ? "sage" : "rush";
      engine.startWin(winner, loser);
    }
    if (!koTrigger && prevKo.current) {
      engine.resetAll();
    }
    prevKo.current = koTrigger;
  }, [koTrigger, rushAccuracy, sageAccuracy]);

  return (
    <section className="relative w-full max-w-[920px]">
      <canvas ref={canvasRef} width={320} height={132} className="pixel-art block w-full" />
      {scanlines && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 2px, transparent 2px, transparent 5px)",
          }}
        />
      )}
      <div className="absolute left-2.5 top-2 text-[8px] text-muted">ARENA-01</div>
      <div className="absolute right-2.5 top-2 text-[8px] text-good">LIVE FEED OK</div>
    </section>
  );
}
