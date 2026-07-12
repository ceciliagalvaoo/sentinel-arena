"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentCardData } from "@/lib/types";
import { formatSol, solscanAddressUrl } from "@/lib/format";
import { SquirrelMascot, type MascotMood, type SquirrelVariant } from "./SquirrelMascot";
import { StatusDot } from "./StatusDot";
import { AccuracyCard } from "./AccuracyCard";
import { EventFeed } from "./EventFeed";
import { CopyableHash } from "./CopyableHash";

interface AgentCardProps {
  data: AgentCardData;
  variant: SquirrelVariant;
  displayName: string;
  tagline: string;
  participant1?: string | null;
  participant2?: string | null;
}

const ACCENT_BORDER: Record<SquirrelVariant, string> = {
  aggressive: "border-t-aggressive",
  conservative: "border-t-conservative",
};

/** A colored ring behind the mascot while it reacts — text/labels stay in ink tokens (dataviz rule), this is purely the glow, never the only cue (motion + pose carry it too). */
const MOOD_GLOW: Record<MascotMood, string> = {
  idle: "bg-surface",
  alert: "bg-surface",
  correct: "bg-good/10",
  incorrect: "bg-critical/10",
};

export function AgentCard({ data, variant, displayName, tagline, participant1, participant2 }: AgentCardProps) {
  const [mood, setMood] = useState<MascotMood>("idle");
  const latestSignalId = data.recentSignals[0]?.id;
  const previousLatestId = useRef(latestSignalId);
  const previousGradedIds = useRef<Set<string>>(new Set(data.recentSignals.filter((s) => s.grade !== null).map((s) => s.id)));
  const moodTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashMood(next: MascotMood, ms: number) {
    if (moodTimeout.current) clearTimeout(moodTimeout.current);
    setMood(next);
    moodTimeout.current = setTimeout(() => setMood("idle"), ms);
  }

  // Two distinct reactions, in priority order: a signal getting graded
  // (correct = cheer, incorrect = wince) is the more meaningful event, so it
  // wins over the plainer "a new signal just landed" alert pulse if both
  // happen in the same tick. Fires for real live updates AND the replay
  // showcase animation, since both update data.recentSignals the same way.
  useEffect(() => {
    const currentGraded = data.recentSignals.filter((s) => s.grade !== null);
    const newlyGraded = currentGraded.find((s) => !previousGradedIds.current.has(s.id));
    previousGradedIds.current = new Set(currentGraded.map((s) => s.id));

    if (newlyGraded) {
      previousLatestId.current = latestSignalId;
      flashMood(newlyGraded.grade!.correct ? "correct" : "incorrect", 1400);
      return;
    }

    if (latestSignalId && latestSignalId !== previousLatestId.current) {
      flashMood("alert", 900);
    }
    previousLatestId.current = latestSignalId;
  }, [data.recentSignals, latestSignalId]);

  useEffect(
    () => () => {
      if (moodTimeout.current) clearTimeout(moodTimeout.current);
    },
    [],
  );

  // Sourced from the backend's full-set aggregate (packages/shared-types
  // AgentAccuracy.allValidationChecked), never computed from the capped
  // recentSignals list — a badge built from a sample could say "verified"
  // while older, unfetched signals weren't (sentinel-dashboard-dev principle #4).
  const fullyVerified = data.accuracy.allValidationChecked === true;

  return (
    <section className={`flex flex-col gap-4 rounded-xl2 border border-border border-t-4 ${ACCENT_BORDER[variant]} bg-surface-raised p-5`}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl2 transition-colors duration-300 ${MOOD_GLOW[mood]}`}>
            <SquirrelMascot variant={variant} mood={mood} />
          </div>
          <div>
            <h2 className="font-serif text-xl text-ink">{displayName}</h2>
            <p className="text-xs text-ink-secondary">{tagline}</p>
          </div>
        </div>
        <StatusDot status={data.status} />
      </header>

      <div className="flex items-center justify-between rounded-xl2 bg-surface px-3 py-2 text-xs">
        <span className="text-ink-muted">Wallet</span>
        <div className="flex items-center gap-3">
          <CopyableHash value={data.agent.walletPubkey} href={solscanAddressUrl(data.agent.walletPubkey)} />
          <span className="font-mono text-ink-secondary">{formatSol(data.wallet.sol)}</span>
        </div>
      </div>

      <AccuracyCard accuracy={data.accuracy} fullyVerified={fullyVerified} />

      <div>
        <div className="mb-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Event feed</span>
        </div>
        <EventFeed signals={data.recentSignals} participant1={participant1} participant2={participant2} />
      </div>
    </section>
  );
}
