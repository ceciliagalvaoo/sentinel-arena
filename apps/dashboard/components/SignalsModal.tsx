"use client";

import { useEffect } from "react";
import type { SignalWithLifecycle } from "@/lib/types";
import { EventFeed } from "./EventFeed";

interface SignalsModalProps {
  open: boolean;
  onClose: () => void;
  /** RUSH / SAGE */
  title: string;
  variant: "rush" | "sage";
  signals: SignalWithLifecycle[];
  participant1?: string | null;
  participant2?: string | null;
}

/**
 * Full-history view for one agent's feed. The card only shows the most recent
 * handful (so the chart below stays reachable); this modal holds ALL of them,
 * scrollable, without stretching the page.
 */
export function SignalsModal({ open, onClose, title, variant, signals, participant1, participant2 }: SignalsModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const nameColor = variant === "rush" ? "text-rush" : "text-sage";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`All signals for ${title}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-[720px] flex-col gap-3 border-4 border-arcborder bg-panel p-5"
        style={{ boxShadow: "0 8px 0 var(--arc-shadow)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-[12px] ${nameColor}`}>{title}</span>
            <span className="text-[8px] text-muted">· {signals.length} SIGNALS</span>
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

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <EventFeed signals={signals} participant1={participant1} participant2={participant2} />
        </div>
      </div>
    </div>
  );
}
