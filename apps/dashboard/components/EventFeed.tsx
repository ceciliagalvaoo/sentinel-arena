"use client";

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
      <div className="bg-panel-row p-2.5 text-center text-[8px] leading-relaxed text-muted">
        NO SIGNALS YET — WAITING FOR THE FIRST MARKET MOVE
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {signals.map((signal) => (
        <FeedRow key={signal.id} signal={signal} participant1={participant1} participant2={participant2} />
      ))}
    </div>
  );
}

function FeedRow({
  signal,
  participant1,
  participant2,
}: {
  signal: SignalWithLifecycle;
  participant1?: string | null;
  participant2?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-panel-row p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[7px] text-muted">{formatTimestamp(signal.detectedAt)}</span>
        <span className="text-[8px] text-ink">
          {formatOutcomeKey(signal.outcomeKey, participant1, participant2).toUpperCase()}{" "}
          <span className="text-muted">{formatPct(signal.pctChange)}</span>
        </span>
        <ResultBadge signal={signal} />
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[7px] leading-relaxed text-muted">
        <span>COMMIT</span>
        {signal.commit ? (
          <CopyableHash value={signal.commit.commitTxSig} href={solscanTxUrl(signal.commit.commitTxSig)} className="text-[7px]" />
        ) : (
          <span className="text-muted">PENDING…</span>
        )}
        <span>→ REVEAL</span>
        {signal.reveal ? (
          <CopyableHash value={signal.reveal.revealTxSig} href={solscanTxUrl(signal.reveal.revealTxSig)} className="text-[7px]" />
        ) : (
          <span className="text-muted">PENDING…</span>
        )}
      </div>
    </div>
  );
}

function ResultBadge({ signal }: { signal: SignalWithLifecycle }) {
  if (!signal.grade) {
    return <span className="text-[7px] text-warn">PENDING…</span>;
  }
  return signal.grade.correct ? (
    <span className="text-[7px] text-good">✓ CORRECT</span>
  ) : (
    <span className="text-[7px] text-bad">✗ WRONG</span>
  );
}
