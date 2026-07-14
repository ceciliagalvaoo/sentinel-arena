"use client";

import { useState } from "react";
import { truncateMiddle } from "@/lib/format";

interface CopyableHashProps {
  value: string;
  href?: string;
  className?: string;
}

/**
 * Every tx signature / hash / address in this product is copyable and, when it
 * points somewhere real, a real link — never decorative text. Arcade skin:
 * pixel font, muted ink, accent on hover.
 */
export function CopyableHash({ value, href, className }: CopyableHashProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API can be unavailable (e.g. insecure context) — fail quietly
    }
  }

  const text = truncateMiddle(value);

  return (
    <span className={`inline-flex items-center gap-1 font-pixel ${className ?? ""}`}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent" title={value}>
          {text}
        </a>
      ) : (
        <span className="text-muted" title={value}>
          {text}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="p-0.5 text-muted transition hover:text-ink"
        aria-label="Copy"
        title="Copy"
      >
        {copied ? (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M13 4L6 11L3 8" stroke="var(--good)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M3.5 10.5V3.5C3.5 2.94772 3.94772 2.5 4.5 2.5H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </span>
  );
}
