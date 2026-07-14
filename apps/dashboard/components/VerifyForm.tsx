"use client";

import { useState, type FormEvent } from "react";
import { verifyProof, type VerificationResult } from "@/lib/api";
import { solscanTxUrl } from "@/lib/format";
import { CopyableHash } from "./CopyableHash";

const CHECK_LABELS: Record<keyof VerificationResult["checks"], string> = {
  signalIdsMatch: "SIGNAL IDS MATCH BETWEEN COMMIT AND REVEAL",
  referencesCorrectCommit: "REVEAL REFERENCES THE CORRECT COMMIT",
  hashesMatch: "REVEALED HASH MATCHES THE COMMITTED HASH",
  commitBeforeReveal: "COMMIT HAPPENED BEFORE THE REVEAL",
};

/**
 * Standalone verifier — works for ANY commit/reveal pair using the Sentinel
 * memo format, not just our two agents. Same on-chain logic as before; arcade
 * skin only.
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
      setError(err instanceof Error ? err.message : "VERIFICATION FAILED — CHECK THE SIGNATURES AND NETWORK.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 bg-panel-soft p-5">
        <label className="flex flex-col gap-1.5 text-[8px] text-muted">
          COMMIT TX SIGNATURE
          <input
            required
            value={commitTxSig}
            onChange={(e) => setCommitTxSig(e.target.value)}
            placeholder="5a8btJRsTBjYeTvDWvXJkwdBdBT7Xs9Lk9CJxL97mdrQ…"
            className="border-2 border-arcborder bg-bg-deep p-2.5 font-pixel text-[8px] text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[8px] text-muted">
          REVEAL TX SIGNATURE
          <input
            required
            value={revealTxSig}
            onChange={(e) => setRevealTxSig(e.target.value)}
            placeholder="294QuTAh2hWAiqJBkWhmMCYerUiGWbj2GywfyovnTKZ…"
            className="border-2 border-arcborder bg-bg-deep p-2.5 font-pixel text-[8px] text-ink outline-none focus:border-accent"
          />
        </label>
        <button type="submit" disabled={loading} className="arc-btn bg-accent p-3.5 text-[10px] text-accent-ink disabled:opacity-50">
          {loading ? "VERIFYING…" : "VERIFY PROOF"}
        </button>
      </form>

      {error && <p className="bg-panel-soft p-4 text-[8px] leading-relaxed text-bad">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3 p-5" style={{ background: result.valid ? "#1f2b21" : "#2b1f1f" }}>
          <div className={`text-[12px] ${result.valid ? "text-good" : "text-bad"}`}>
            {result.valid ? "✓ VALID PROOF" : "✗ INVALID PROOF"}
          </div>
          <div className="flex flex-col gap-2 text-[8px] leading-relaxed text-ink-soft">
            {(Object.keys(result.checks) as Array<keyof VerificationResult["checks"]>).map((key) => (
              <div key={key}>
                <span className={result.checks[key] ? "text-good" : "text-bad"}>{result.checks[key] ? "✓" : "✗"}</span> {CHECK_LABELS[key]}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 border-t-2 border-arcborder pt-2.5 text-[7px] text-muted">
            <span>
              COMMIT SLOT: <span className="text-ink">{result.commitSlot ?? "—"}</span>
            </span>
            <span>
              REVEAL SLOT: <span className="text-ink">{result.revealSlot ?? "—"}</span>
            </span>
            <CopyableHash value={commitTxSig} href={solscanTxUrl(commitTxSig)} className="text-[7px]" />
            <CopyableHash value={revealTxSig} href={solscanTxUrl(revealTxSig)} className="text-[7px]" />
          </div>
        </div>
      )}
    </div>
  );
}
