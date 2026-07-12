"use client";

import { useEffect } from "react";
import { SquirrelMascot } from "./SquirrelMascot";

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * A friendly, illustrated walkthrough for a first-time visitor — a judge
 * shouldn't need to have read the architecture doc to understand what
 * they're looking at. Every concept here maps 1:1 to something actually
 * visible on the dashboard, in the same order top-to-bottom.
 */
export function TutorialModal({ open, onClose }: TutorialModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to read this dashboard"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl2 border border-border bg-surface-raised p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl text-ink">How to read this thing 👀</h2>
            <p className="mt-1 text-sm text-ink-secondary">A 60-second, no-jargon tour of every piece on screen.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-sm text-ink-secondary transition hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <Step icon="🐿️" title="Two little traders, same information">
            <div className="mb-3 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 rounded-xl2 bg-surface p-1">
                  <SquirrelMascot variant="aggressive" />
                </div>
                <span className="text-xs font-medium text-aggressive">Aggressive</span>
              </div>
              <span className="text-ink-muted">vs.</span>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 rounded-xl2 bg-surface p-1">
                  <SquirrelMascot variant="conservative" />
                </div>
                <span className="text-xs font-medium text-conservative">Conservative</span>
              </div>
            </div>
            Both agents watch the exact same live odds feed, at the exact same time — no information advantage either way. The
            only difference is how twitchy they are: <b className="text-ink">Aggressive</b> reacts to almost any wobble in the
            odds, <b className="text-ink">Conservative</b> only moves when the swing is dramatic. That's the whole experiment:
            same eyes, different nerves — which one calls it better?
          </Step>

          <Step icon="⚡" title="A &ldquo;signal&rdquo; is just: &ldquo;the odds just moved a lot&rdquo;">
            Every row in the feed starts when an agent notices the betting odds for an outcome (say, &ldquo;France wins&rdquo;)
            shift more than usual. That's it — no human picks it, a formula does, based on how jumpy that particular match has
            been so far.
          </Step>

          <Step icon="🔒" title="The clever part: a locked box before the game ends">
            This is the whole point of the project, so stick with the analogy: the instant an agent spots a signal, it drops its
            prediction into a <b className="text-ink">locked box</b> and publishes the box (well — its fingerprint, a
            cryptographic hash) on the Solana blockchain. Nobody, not even us, can open or edit that box afterwards.
            <br />
            <br />
            Only once the real match actually ends does the agent publish the key (the <b className="text-ink">reveal</b>) and
            everyone can check the box's contents matched the fingerprint all along. That's why it's called
            <b className="text-ink"> commit → reveal</b>: it's mathematical proof the agent isn't cherry-picking winners after
            the fact.
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl2 border border-dashed border-border bg-surface p-3 font-mono text-[11px] text-ink-secondary">
              <span className="font-semibold text-ink">SIGNAL</span>
              <Arrow />
              <span className="font-semibold text-ink">COMMIT</span>
              <span className="text-ink-muted">(locked box, published)</span>
              <Arrow />
              <span className="italic text-ink-muted">waiting for the final whistle…</span>
              <Arrow />
              <span className="font-semibold text-ink">REVEAL</span>
              <span className="text-ink-muted">(key published, box opened)</span>
              <Arrow />
              <span>✅ / ❌</span>
            </div>
          </Step>

          <Step icon="🎯" title="The accuracy card and the green badge">
            The big percentage is simply <i>correct predictions ÷ graded predictions</i> — nothing fancier. The
            <span className="mx-1 inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-[11px] font-medium text-good">
              ✓ verified on-chain
            </span>
            badge only lights up green once <i>every single</i> graded signal behind that number has ALSO had its final score
            double-checked against TxLINE's own on-chain proof — not just trusted from an API response. If even one hasn't, you'll
            see an amber &ldquo;verification pending&rdquo; instead. We'd rather show that than fake a green checkmark.
            <div className="mt-3 rounded-xl2 border border-dashed border-border bg-surface p-3 text-xs text-ink-muted">
              <b className="text-ink-secondary">Why is the number itself so low (often under 50%)?</b> Each agent tracks
              three markets at once for every match — &ldquo;Team A wins&rdquo;, &ldquo;draw&rdquo;, &ldquo;Team B wins&rdquo;
              — and fires a signal on whichever one's odds move sharply. Only one of the three can end up true, so two out of
              three buckets are guaranteed &ldquo;incorrect&rdquo; once the match ends, even if the read was solid in the
              moment. Chance alone lands around 33%, not 50% — check any signal that bet on the actual final result and
              you'll find it's right basically every time.
            </div>
          </Step>

          <Step icon="📡" title="Live vs. Replay — both are the real thing">
            <span className="font-semibold text-ink">Live</span> means an actual match is happening right now and you're watching
            it unfold in real time. <span className="font-semibold text-ink">Replay</span> reproduces a match that already
            happened, using the exact same real signals, hashes, and results — just compressed into about a minute so you don't
            have to wait around. Hit <span className="font-mono text-ink-secondary">skip to the end →</span> if you'd rather see
            the finished picture immediately.
          </Step>

          <Step icon="📈" title="The chart at the bottom">
            One line per agent, tracking accuracy as more predictions get graded over time. If the orange line climbs above the
            blue one, Aggressive is calling it better on this match so far — and vice versa.
          </Step>

          <Step icon="🔍" title="The Verify page">
            Anyone — you, a judge, a stranger on the internet — can paste any commit + reveal transaction pair (ours or someone
            else's using the same format) into the standalone verify tool in the footer and get an independent yes/no on whether
            the proof holds up. It re-derives everything from the Solana blockchain itself; it doesn't ask us to vouch for it.
          </Step>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl2 bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
        >
          Got it, let's go →
        </button>
      </div>
    </div>
  );
}

function Step({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-xl leading-none" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-ink-secondary">{children}</div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <span className="text-ink-muted" aria-hidden>
      →
    </span>
  );
}
