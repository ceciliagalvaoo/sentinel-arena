"use client";

import { useState, type FormEvent } from "react";
import { verifyProof, type VerificationResult } from "@/lib/api";
import { solscanTxUrl } from "@/lib/format";
import { CopyableHash } from "./CopyableHash";

const CHECK_LABELS: Record<keyof VerificationResult["checks"], string> = {
  signalIdsMatch: "Signal IDs match between commit and reveal",
  referencesCorrectCommit: "Reveal references the correct commit",
  hashesMatch: "Revealed hash matches the committed hash",
  commitBeforeReveal: "Commit happened before the reveal",
};

/**
 * Standalone tool — works for ANY commit/reveal pair using the Sentinel
 * memo format, not just ones our own two agents produced (architecture doc
 * section 4.3).
 */
export function VerifyForm() {
  const [commitTxSig, setCommitTxSig] = useState("");
  const [revealTxSig, setRevealTxSig] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const verification = await verifyProof(commitTxSig.trim(), revealTxSig.trim());
      setResult(verification);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed — check the signatures and network.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl2 border border-border bg-surface-raised p-5">
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          Commit tx signature
          <input
            required
            value={commitTxSig}
            onChange={(e) => setCommitTxSig(e.target.value)}
            placeholder="e.g. 5a8btJRsTBjYeTvDWvXJkwdBdBT7Xs9Lk9CJxL97mdrQ..."
            className="rounded-xl2 border border-border bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          Reveal tx signature
          <input
            required
            value={revealTxSig}
            onChange={(e) => setRevealTxSig(e.target.value)}
            placeholder="e.g. 294QuTAh2hWAiqJBkWhmMCYerUiGWbj2GywfyovnTKZ..."
            className="rounded-xl2 border border-border bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-xl2 bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify proof"}
        </button>
      </form>

      {error && <p className="rounded-xl2 border border-critical/30 bg-critical/10 p-4 text-sm text-critical">{error}</p>}

      {result && (
        <div className={`rounded-xl2 border p-5 ${result.valid ? "border-good/30 bg-good/5" : "border-critical/30 bg-critical/5"}`}>
          <p className={`text-lg font-semibold ${result.valid ? "text-good" : "text-critical"}`}>
            {result.valid ? "✅ Valid proof" : "❌ Invalid proof"}
          </p>

          <ul className="mt-3 flex flex-col gap-1.5">
            {(Object.keys(result.checks) as Array<keyof VerificationResult["checks"]>).map((key) => (
              <li key={key} className="flex items-center gap-2 text-sm">
                <span className={result.checks[key] ? "text-good" : "text-critical"}>{result.checks[key] ? "✓" : "✗"}</span>
                <span className="text-ink-secondary">{CHECK_LABELS[key]}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-ink-muted">
            <span>
              commit slot: <span className="font-mono text-ink-secondary">{result.commitSlot ?? "—"}</span>
            </span>
            <span>
              reveal slot: <span className="font-mono text-ink-secondary">{result.revealSlot ?? "—"}</span>
            </span>
            <CopyableHash value={commitTxSig} href={solscanTxUrl(commitTxSig)} />
            <CopyableHash value={revealTxSig} href={solscanTxUrl(revealTxSig)} />
          </div>
        </div>
      )}
    </div>
  );
}
