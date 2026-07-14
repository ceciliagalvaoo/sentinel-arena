import Link from "next/link";
import { VerifyForm } from "@/components/VerifyForm";

/** The public commit-reveal verification tool — a standalone mini-product, not just a debug screen. */
export default function VerifyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[640px] flex-col gap-6 px-4 py-14">
      <Link href="/" className="text-[9px] text-muted hover:text-ink">
        ← BACK TO THE ARENA
      </Link>
      <div className="flex flex-col gap-4">
        <h1 className="arc-wordmark text-[20px] tracking-[2px] text-ink">VERIFY A PROOF</h1>
        <p className="text-[8px] leading-loose text-muted">
          PASTE THE COMMIT AND REVEAL TX SIGNATURES — ANY PAIR USING THE SENTINEL ARENA MEMO FORMAT, NOT JUST THE ONES OUR OWN TWO
          AGENTS PRODUCED. WE CONFIRM ON-CHAIN: HASHES MATCH, CORRECT REFERENCE, AND THE COMMIT PUBLISHED BEFORE THE REVEAL.
        </p>
      </div>
      <VerifyForm />
    </main>
  );
}
