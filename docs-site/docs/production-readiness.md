---
id: production-readiness
title: Production Readiness & Judging Criteria
sidebar_label: Production Readiness
---

# Production Readiness & Judging Criteria

This page maps Sentinel Arena directly to the **Trading Tools and Agents** track's five judging criteria, point by point, plus the hardening work that separates "ran once" from "a real trading desk could use this tomorrow."

## Criteria mapping

### Core Functionality & Data Ingestion

The agent ingests both Odds and Scores **simultaneously**, in real time, via TxLINE's live SSE streams, with a deterministic replay fallback fed by real backfilled history. Every piece of state is indexed by `fixtureId` from the first commit — the same two processes already cover every fixture TxLINE streams at once, with zero architecture changes needed to track more matches (see [Architecture](/architecture#design-principle-2-everything-indexed-by-fixture-from-day-one)).

### Autonomous Operation

Eliminatory, not a matter of degree — and treated that way throughout. No dashboard button lets a human intervene. The auto-calibrated threshold (`mean + k·σ`) removes the last human-tunable parameter from the *strategy* itself — the only human choice left is the sensitivity multiplier `k`, which is the strategy, not an alarm dial. Orphaned-signal reconciliation runs automatically on every process start, with no operator step, and explicitly refuses to "fix" a commit in a way that would be dishonest (see below).

### Logic & Code Architecture

The commit-reveal scheme forces a precise, auditable explanation of *why* the agent's track record can be trusted — there's no "trust us" step. The `MarketDataSource` abstraction demonstrates real separation of concerns: the agent's decision code is provably identical whether the underlying data is live or replayed, because it's the exact same code path either way, not two implementations that happen to agree. The idempotency guard is explicit in the architecture, not a hidden detail — it shows the design anticipated reprocessing and failure from day one.

### Innovation & Novelty

No other expected submission proves agent reputation with cryptographic guarantees — most will *claim* a win rate; this one *proves* one. The public, standalone verification tool (works for **any** commit/reveal pair using this memo format, not only these two agents') signals ambition toward reusable infrastructure, not just a one-off demo. Layering on-chain Merkle proof validation of both the graded result *and* the specific triggering odds tick — not just the commit-reveal hash — pushes the "don't just trust the API response" argument further than commit-reveal alone would.

### Production Readiness

A verifiable on-chain track record, two agents with documented, comparable, genuinely different strategies, and a replay mode that doubles as a deterministic test harness. Reconnection with exponential backoff and wallet balance monitoring cover the two most likely real-world failure modes head-on, not just the happy path — see the incidents below, all found and fixed against real devnet transactions, not hypothesized.

## Hardening, found and fixed against real devnet traffic

Every item below was a genuine defect found while testing against live infrastructure, not a theoretical risk written up in advance:

- **Wallet balance monitor was logging a warning but never actually pausing anything** — the architecture called for pausing new commits gracefully before a wallet hit zero; an earlier build only warned. Fixed: the agent now tracks a real `paused` state, gated on the same threshold the monitor checks, blocking new commit attempts (never reveals already in flight) until the balance recovers.
- **A settlement race**: because `MarketDataSource.onOdds`/`onScore` are fire-and-forget by design, a `game_finalised` event could be processed before every earlier commit for that fixture had actually landed, silently dropping their reveal/grade. Fixed by enqueuing the entire settlement as one atomic unit on the same serialized transaction queue used for commits, guaranteeing real FIFO order.
- **`ReconnectingSseClient` was implemented but never actually wired into `LiveTxLineSource`** — found in a self-audit, not a crash. Fixed and confirmed against a real (not simulated) network timeout during a live-mode test: the process didn't die, and reconnected on its own.
- **A live fixture had no path to register itself in the database** — `signals.fixture_id` is a required foreign key into `tracked_fixtures`, but only the historical-backfill script ever wrote that table; nothing did so for a genuinely new live match. The very first signal for a brand-new live fixture would have failed on the foreign-key constraint. Fixed: the agent now registers a fixture (fetching real team names best-effort, never blocking on it) the moment it sees the first event for a fixture it hasn't seen yet, and marks it `finished` the moment `game_finalised` is processed — tested end-to-end against a synthetic fixture ID with no pre-existing row.
- **Public devnet RPC rate-limits aggressively under a burst of transactions.** Found running the agent loop against an accelerated replay, which naturally generates several commits in quick succession. Fixed with a serialized transaction queue with minimum spacing between publishes; for real production load, a dedicated RPC provider (Helius, QuickNode, etc.) would still be the right call over the public endpoint, even on devnet.
- **The dashboard's "verified on-chain" badge was computed from a capped sample of 50 recent signals**, not the full graded set — a real, if subtle, violation of "never show a badge optimistically." Fixed by computing it server-side over every graded signal.
- **Solscan links were hardcoded to `cluster=devnet`**, which would have silently broken on a mainnet deploy. Fixed by driving the cluster from a single environment-configured constant, referenced everywhere instead of a literal string.

None of these were caught by code review alone — every one surfaced by actually running the system against live devnet transactions and a real TxLINE feed, then fixing what broke and re-verifying against real data again. That loop — write, run for real, find what's actually wrong, fix, re-verify — is the same discipline a production trading desk would expect, applied consistently through the whole build.
