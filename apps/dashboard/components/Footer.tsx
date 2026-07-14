import Link from "next/link";

export function Footer() {
  return (
    <footer className="flex max-w-[700px] flex-col items-center gap-2 text-center text-[8px] leading-loose text-muted">
      <p className="m-0">SENTINEL ARENA · TXODDS WORLD CUP HACKATHON · TRACK: TRADING TOOLS AND AGENTS</p>
      <p className="m-0">
        THE SIGNAL FEED IS REAL AND ON-CHAIN: CORRECT → HOP · WRONG → SAD · NEW COMMIT → EAT · END OF MATCH → WINNER PUNCHES.
      </p>
      <Link href="/verify" className="text-accent hover:underline">
        VERIFY A COMMIT-REVEAL PROOF →
      </Link>
    </footer>
  );
}
