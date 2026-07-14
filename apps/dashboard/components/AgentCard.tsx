"use client";

import { useState } from "react";
import type { AgentCardData } from "@/lib/types";
import { formatSol, solscanAddressUrl } from "@/lib/format";
import { AccuracyCard } from "./AccuracyCard";
import { EventFeed } from "./EventFeed";
import { CopyableHash } from "./CopyableHash";
import { SignalsModal } from "./SignalsModal";

/** How many feed rows the card shows before "VIEW ALL" — keeps the card short so the chart stays reachable. */
const FEED_LIMIT = 20;

interface AgentCardProps {
  data: AgentCardData;
  variant: "rush" | "sage";
  /** RUSH / SAGE */
  displayName: string;
  /** e.g. "THE AGGRESSIVE AGENT · k=1.5 · REACTS FAST TO ANY MOVE" */
  tagline: string;
  participant1?: string | null;
  participant2?: string | null;
}

/**
 * Arcade agent card (borderless, tinted). The mascot moved out of the card into
 * the shared ArenaScene; the card now carries only the numbers: name + verified
 * badge, strategy line, accuracy, the pixel bar, and the event feed. A micro
 * wallet line stays as real on-chain proof (production readiness).
 */
export function AgentCard({ data, variant, displayName, tagline, participant1, participant2 }: AgentCardProps) {
  const [allOpen, setAllOpen] = useState(false);
  const nameColor = variant === "rush" ? "text-rush" : "text-sage";
  // Sourced from the backend's full-set aggregate, never the capped feed — a
  // badge built from a sample could say "verified" while older signals weren't.
  const fullyVerified = data.accuracy.allValidationChecked === true;
  const hasGraded = data.accuracy.totalGradedSignals > 0;

  const total = data.recentSignals.length;
  const visibleSignals = data.recentSignals.slice(0, FEED_LIMIT);

  return (
    <div className="flex flex-col gap-2.5 bg-panel-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <div className={`text-[12px] ${nameColor}`}>{displayName}</div>
        {hasGraded &&
          (fullyVerified ? (
            <div className="text-[8px] text-good">✓ VERIFIED ON-CHAIN</div>
          ) : (
            <div className="animate-arcblink text-[8px] text-warn">VERIFY PENDING…</div>
          ))}
      </div>

      <div className="text-[8px] leading-relaxed text-muted">{tagline}</div>

      <AccuracyCard accuracy={data.accuracy} variant={variant} />

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[8px] tracking-widest text-muted">EVENT FEED</span>
        {total > FEED_LIMIT && (
          <span className="text-[7px] text-muted">
            SHOWING {FEED_LIMIT} OF {total}
          </span>
        )}
      </div>
      <EventFeed signals={visibleSignals} participant1={participant1} participant2={participant2} />

      {total > FEED_LIMIT && (
        <button
          type="button"
          onClick={() => setAllOpen(true)}
          className="arc-btn-sm bg-panel-raised px-3 py-2 text-[8px] text-ink"
        >
          ▸ VIEW ALL {total} SIGNALS
        </button>
      )}

      <SignalsModal
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={displayName}
        variant={variant}
        signals={data.recentSignals}
        participant1={participant1}
        participant2={participant2}
      />

      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[7px] text-muted">
        <span className="tracking-wide">WALLET</span>
        <div className="flex items-center gap-3">
          <CopyableHash value={data.agent.walletPubkey} href={solscanAddressUrl(data.agent.walletPubkey)} className="text-[7px]" />
          <span className="text-muted">{formatSol(data.wallet.sol)}</span>
        </div>
      </div>
    </div>
  );
}
