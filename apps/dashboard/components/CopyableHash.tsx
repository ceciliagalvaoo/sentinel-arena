"use client";

import { useState } from "react";
import { truncateMiddle } from "@/lib/format";

interface CopyableHashProps {
  value: string;
  href?: string;
  className?: string;
}

/**
 * Every tx signature / hash / address in this product is copyable and,
 * when it points somewhere real, a real link — never decorative text
 * (architecture doc's "verifiable trust" principle for this dashboard).
 */
export function CopyableHash({ value, href, className }: CopyableHashProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API can be unavailable (e.g. insecure context) — fail quietly, copy just won't work
    }
  }

  const text = truncateMiddle(value);

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${className ?? ""}`}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-secondary underline decoration-border underline-offset-2 hover:text-accent"
          title={value}
        >
          {text}
        </a>
      ) : (
        <span className="text-ink-secondary" title={value}>
          {text}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="rounded p-0.5 text-ink-muted transition hover:bg-surface-raised hover:text-ink"
        aria-label="Copiar"
        title="Copiar"
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M13 4L6 11L3 8" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M3.5 10.5V3.5C3.5 2.94772 3.94772 2.5 4.5 2.5H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </span>
  );
}
