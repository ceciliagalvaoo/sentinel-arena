---
id: dashboard-user-flow
title: Dashboard & User Flow
sidebar_label: Dashboard & User Flow
---

# Dashboard & User Flow

The dashboard is deliberately **read-only** — there is no button anywhere that lets a human intervene in what the agents do. That's not a missing feature; it's a visual reinforcement of the Autonomous Operation claim: nothing about the product depends on a human clicking anything after deploy.

## What's on screen

**Header** — the Sentinel Arena logo and name, a live/mock data indicator, a Live/Replay toggle, and a fixture selector (filtered to whichever mode is active). A "How this works" button opens a plain-language, illustrated tutorial covering every concept below — written for someone who has never seen the project before, not just for a judge who already read this documentation.

**Two agent cards, always side by side** — never a secondary tab. Each shows:
- The agent's pixel-art mascot (an original design — a warm-toned, alert squirrel for Aggressive; a cool-toned, watchful squirrel for Conservative), which reacts live: a quick pulse when a new signal lands, a bouncy "cheer" animation when a signal grades correct, a "wince" animation when one grades incorrect. Aggressive's reactions play faster and bigger; Conservative's play slower and calmer — matching their strategy, not just their color.
- Wallet address (linked to Solscan) and live SOL balance.
- An accuracy card: `X correct / Y graded signals`, with a "✅ verified on-chain" badge that only appears once every graded signal behind that number has been independently cross-checked against TxLINE's on-chain proof (see [Solana & Commit-Reveal](/solana-commit-reveal)) — never shown optimistically.
- A chronological event feed: `SIGNAL → COMMIT (tx) → [waiting] → REVEAL (tx) → ✅/❌`, with every hash truncated-but-copyable and linked straight to Solscan.

**Comparison chart** — one line per agent, cumulative accuracy over time, on a single shared axis (never a dual-axis chart) with a legend always present, per the project's own charting standard.

**Verify page** (`/verify`) — a standalone mini-tool, not a debug screen: paste any commit + reveal transaction signature pair and get an independent yes/no on the proof, with each of the four checks broken out individually. Works for any pair using the Sentinel Arena memo format, not only the ones these two agents produced.

## Live vs. Replay — both are the real thing, never a "degraded mode"

Live means an actual match is streaming right now. Replay reproduces a match that already happened, using the exact same real signals, hashes, and results — the judging calendar means most demos will happen in this mode, so it was built to first-class quality, not as an afterthought.

### The replay showcase animation

A finished fixture doesn't keep producing new events on its own — without more, a judge opening the dashboard after the agents already finished would just see a frozen final state, with nothing to actually watch happen. Rather than re-running the agents against Solana again for every visitor (real cost, real rate-limit risk, and not repeatable on demand), the dashboard **replays the fixture's already-real history client-side**: the genuine `detectedAt`/`revealedAt` timestamps, compressed into about a minute, so the SIGNAL → COMMIT → REVEAL progression is visible no matter when someone opens the page — repeatable for every visitor, at zero additional devnet cost. A "skip to the end" control is always available for anyone who wants the finished picture immediately, and the accuracy numbers climb in sync with the animation rather than jumping straight to their final values.

A signal that was detected but never actually reached the chain (the orphaned-signal integrity guard correctly refusing to back-commit after a fixture was already graded — see [Architecture](/architecture)) is excluded from this showcase specifically, since it has no commit/reveal to animate and would otherwise sit as an unresolved row forever. It remains fully visible via the API for anyone auditing directly.

## Design system

Warm neutral surfaces (cream/off-white in light mode, warm graphite in dark mode) with a single accent color — a deep indigo-violet, deliberately its own hue family rather than the industry-standard AI-product orange — used sparingly (the logo, active toggle states, links). The two agents keep their own validated categorical pair (a hot coral-red for Aggressive, a blue for Conservative; ΔE 90+ apart, well above the colorblind-safety floor), which is a separate design decision from the brand accent, not the same color reused for two jobs.

## Why "accuracy" often reads under 50%

Covered in full in [The Agents](/agents#why-the-raw-accuracy--number-looks-lower-than-50), and explained directly to a first-time viewer inside the dashboard's own tutorial: each agent tracks three markets per match simultaneously, and only one can be correct once the match ends, so the statistical floor from chance alone is closer to 33% than 50%.
