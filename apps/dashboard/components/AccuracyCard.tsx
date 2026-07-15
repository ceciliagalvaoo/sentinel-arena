import type { AgentAccuracy } from "@/lib/types";

interface AccuracyCardProps {
  accuracy: AgentAccuracy;
  /** Which agent's colour the progress bar uses. */
  variant: "rush" | "sage";
  /** "all-matches" (live: the backend's lifetime aggregate) or "this-match" (replay showcase: derived just from the selected fixture's own signals) — the label must track which one `accuracy` actually is, since the two can differ a lot. */
  scope: "all-matches" | "this-match";
}

/**
 * The big accuracy number + "X / N GRADED" + a pixel progress bar. Borderless,
 * tinted only (arcade theme). The verified/pending badge lives in AgentCard's
 * header, next to the name — see AgentCard.
 */
export function AccuracyCard({ accuracy, variant, scope }: AccuracyCardProps) {
  const pct = accuracy.totalGradedSignals === 0 ? null : Math.round(accuracy.accuracy * 1000) / 10;
  const barColor = variant === "rush" ? "var(--rush)" : "var(--sage)";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[7px] tracking-wide text-muted">
        {scope === "all-matches" ? "OVERALL ACCURACY · ALL MATCHES" : "ACCURACY · THIS MATCH"}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl leading-none tabular-nums text-ink">{pct === null ? "—" : `${pct}%`}</span>
        <span className="text-[8px] leading-relaxed tabular-nums text-muted">
          {accuracy.correctSignals} / {accuracy.totalGradedSignals} GRADED
        </span>
      </div>
      <div className="h-2.5 w-full bg-bg-deep">
        <div className="h-full" style={{ width: `${pct ?? 0}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}
