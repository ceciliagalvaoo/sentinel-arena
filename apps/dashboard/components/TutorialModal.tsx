"use client";

import { useEffect, useRef } from "react";
import { drawMiniSquirrel } from "@/lib/arena-engine";

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "HOW TO USE" — a no-jargon tour of the arena for a first-time visitor. Every
 * concept maps 1:1 to something visible on screen. Vocabulary is "use", never
 * "play" (blockchain tool, not a toy).
 */
export function TutorialModal({ open, onClose }: TutorialModalProps) {
  const rushRef = useRef<HTMLCanvasElement>(null);
  const sageRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (rushRef.current) drawMiniSquirrel(rushRef.current, "rush");
    if (sageRef.current) drawMiniSquirrel(sageRef.current, "sage");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10 text-left"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to use the arena"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[640px] flex-col gap-4 border-4 border-accent bg-panel p-5"
        style={{ boxShadow: "0 8px 0 var(--arc-shadow)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink">HOW TO USE</div>
            <div className="text-[8px] leading-relaxed text-muted">A 60-SECOND, NO-JARGON TOUR OF THE ARENA.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="bg-panel-row px-2.5 py-2 font-pixel text-[10px] text-muted transition hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2.5 border-2 border-arcborder p-3.5">
          <div className="text-[9px] text-ink">1UP · TWO LITTLE TRADERS, SAME INFORMATION</div>
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-2">
              <canvas ref={rushRef} width={14} height={16} className="pixel-art block h-8 w-7" />
              <span className="text-[8px] text-rush">RUSH (AGGRESSIVE)</span>
            </span>
            <span className="text-[8px] text-muted">VS</span>
            <span className="flex items-center gap-2">
              <canvas ref={sageRef} width={14} height={16} className="pixel-art block h-8 w-7" style={{ transform: "scaleX(-1)" }} />
              <span className="text-[8px] text-sage">SAGE (CONSERVATIVE)</span>
            </span>
          </div>
          <div className="text-[8px] leading-loose text-ink-soft">
            BOTH WATCH THE SAME LIVE ODDS FEED AT THE SAME TIME. RUSH REACTS TO ALMOST ANY WOBBLE (k=1.5); SAGE ONLY MOVES ON
            DRAMATIC SWINGS (k=3.0).
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-2 border-arcborder p-3.5">
          <div className="text-[9px] text-ink">2UP · A LOCKED BOX BEFORE THE GAME ENDS</div>
          <div className="text-[8px] leading-loose text-ink-soft">
            WHEN AN AGENT SPOTS A SIGNAL, IT LOCKS ITS PREDICTION AND PUBLISHES THE HASH ON SOLANA. ONLY AFTER THE MATCH DOES IT
            REVEAL — PROOF IT NEVER CHERRY-PICKS WINNERS AFTER THE FACT.
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-panel-row p-2.5 text-[7px]">
            <span className="text-ink">SIGNAL</span>
            <span className="text-muted">→</span>
            <span className="text-ink">COMMIT</span>
            <span className="text-muted">(LOCKED BOX)</span>
            <span className="text-muted">→</span>
            <span className="text-muted">FINAL WHISTLE…</span>
            <span className="text-muted">→</span>
            <span className="text-ink">REVEAL</span>
            <span className="text-muted">→</span>
            <span className="text-good">✓</span>
            <span className="text-muted">/</span>
            <span className="text-bad">✗</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-2 border-arcborder p-3.5">
          <div className="text-[9px] text-ink">3UP · THE ACCURACY BAR AND THE GREEN BADGE</div>
          <div className="text-[8px] leading-loose text-ink-soft">
            THE BIG PERCENTAGE IS CORRECT ÷ GRADED. <span className="text-good">✓ VERIFIED ON-CHAIN</span> ONLY LIGHTS UP ONCE
            EVERY GRADED SIGNAL IS DOUBLE-CHECKED AGAINST TXLINE&apos;S OWN ON-CHAIN PROOF — OTHERWISE YOU SEE{" "}
            <span className="text-warn">VERIFY PENDING…</span>
          </div>
        </div>

        <button type="button" onClick={onClose} className="arc-btn bg-accent p-3.5 text-[10px] text-accent-ink">
          GOT IT — BACK TO THE ARENA ▶
        </button>
      </div>
    </div>
  );
}
