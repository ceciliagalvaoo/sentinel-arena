import Link from "next/link";

export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-ink-muted">
      <p>Sentinel Arena · TxODDS World Cup Hackathon · Track: Trading Tools and Agents</p>
      <Link href="/verify" className="font-medium text-accent hover:underline">
        Verify a commit-reveal proof →
      </Link>
    </footer>
  );
}
