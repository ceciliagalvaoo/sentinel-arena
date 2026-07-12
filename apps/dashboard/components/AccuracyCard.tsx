import type { AgentAccuracy } from "@/lib/types";

interface AccuracyCardProps {
  accuracy: AgentAccuracy;
  /** True only when every graded signal behind this number had its Validation Proof cross-checked on-chain. */
  fullyVerified: boolean;
}

export function AccuracyCard({ accuracy, fullyVerified }: AccuracyCardProps) {
  const pct = accuracy.totalGradedSignals === 0 ? null : Math.round(accuracy.accuracy * 1000) / 10;

  return (
    <div className="rounded-xl2 border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Accuracy</span>
        {accuracy.totalGradedSignals > 0 &&
          (fullyVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-[11px] font-medium text-good">
              <CheckIcon /> verified on-chain
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              verification pending
            </span>
          ))}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <span className="text-4xl font-semibold tabular-nums text-ink">{pct === null ? "—" : `${pct}%`}</span>
        <span className="pb-1 text-sm text-ink-secondary tabular-nums">
          {accuracy.correctSignals} correct / {accuracy.totalGradedSignals} graded signal{accuracy.totalGradedSignals === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
      <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
