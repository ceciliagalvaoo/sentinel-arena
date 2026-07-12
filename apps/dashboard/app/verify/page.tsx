import Link from "next/link";
import { VerifyForm } from "@/components/VerifyForm";

/** The public commit-reveal verification tool (architecture doc section 4.3) — a standalone mini-product, not just a debug screen. */
export default function VerifyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-ink-muted hover:text-ink">
        ← back
      </Link>
      <div>
        <h1 className="font-serif text-3xl text-ink">Verify a proof</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Paste the commit and reveal transaction signatures — any pair generated with the Sentinel Arena memo format, not just the
          ones our own two agents produced — and we confirm the proof on-chain: hashes matching, correct reference, and the commit
          published before the reveal.
        </p>
      </div>
      <VerifyForm />
    </main>
  );
}
