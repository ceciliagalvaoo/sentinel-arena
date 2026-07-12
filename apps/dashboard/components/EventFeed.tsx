"use client";

import { useEffect, useRef, useState } from "react";
import type { SignalWithLifecycle } from "@/lib/types";
import { formatOutcomeKey, formatPct, formatTimestamp, solscanTxUrl } from "@/lib/format";
import { CopyableHash } from "./CopyableHash";

interface EventFeedProps {
  signals: SignalWithLifecycle[];
  participant1?: string | null;
  participant2?: string | null;
}

export function EventFeed({ signals, participant1, participant2 }: EventFeedProps) {
  if (signals.length === 0) {
    return (
      <div className="rounded-xl2 border border-dashed border-border p-6 text-center text-sm text-ink-muted">
        No signals yet — waiting for the first market move.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {signals.map((signal) => (
        <FeedRow key={signal.id} signal={signal} participant1={participant1} participant2={participant2} />
      ))}
    </ul>
  );
}

/** stage is a small fingerprint of "how far this signal has progressed" — a change here means visible new proof landed. */
function stageOf(signal: SignalWithLifecycle): string {
  return [signal.commit ? "C" : "", signal.reveal ? "R" : "", signal.grade ? (signal.grade.correct ? "✓" : "✗") : ""].join("");
}

function FeedRow({ signal, participant1, participant2 }: { signal: SignalWithLifecycle; participant1?: string | null; participant2?: string | null }) {
  const stage = stageOf(signal);
  const previousStage = useRef(stage);
  const [flash, setFlash] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // First mount: play the gentle "row-enter" slide instead of a flash.
    const isNew = previousStage.current === stage && !entered;
    if (isNew) {
      setEntered(true);
      return;
    }
    if (previousStage.current !== stage) {
      previousStage.current = stage;
      setFlash(true);
      const timeout = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(timeout);
    }
  }, [stage, entered]);

  return (
    <li className={`animate-row-enter rounded-xl2 border border-border bg-surface p-3 ${flash ? "animate-stage-flash" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-muted">{formatTimestamp(signal.detectedAt)}</span>
          <span className="text-sm font-medium text-ink">{formatOutcomeKey(signal.outcomeKey, participant1, participant2)}</span>
          <span className="font-mono text-xs text-ink-secondary">{formatPct(signal.pctChange)}</span>
        </div>
        <ResultBadge signal={signal} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <FeedStage label="SIGNAL" done />
        <Arrow />
        <FeedStage label="COMMIT" done={!!signal.commit}>
          {signal.commit && <CopyableHash value={signal.commit.commitTxSig} href={solscanTxUrl(signal.commit.commitTxSig)} />}
        </FeedStage>
        <Arrow />
        <FeedStage label={signal.reveal ? "REVEAL" : "pending"} done={!!signal.reveal} pending={!signal.reveal}>
          {signal.reveal && <CopyableHash value={signal.reveal.revealTxSig} href={solscanTxUrl(signal.reveal.revealTxSig)} />}
        </FeedStage>
      </div>
    </li>
  );
}

function FeedStage({ label, done, pending, children }: { label: string; done: boolean; pending?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          pending ? "text-ink-muted italic" : done ? "text-ink" : "text-ink-muted"
        }`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Arrow() {
  return (
    <span className="text-ink-muted" aria-hidden>
      →
    </span>
  );
}

function ResultBadge({ signal }: { signal: SignalWithLifecycle }) {
  if (!signal.grade) {
    return <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-ink-muted">in progress</span>;
  }
  return signal.grade.correct ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-[11px] font-medium text-good">✅ correct</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-critical/10 px-2 py-0.5 text-[11px] font-medium text-critical">
      ❌ incorrect
    </span>
  );
}
