---
id: production-readiness
title: Hardening & Incidents
sidebar_label: Hardening & Incidents
---

# Hardening & Incidents

> Looking for how the build maps to the track's five judging criteria? That lives in the [**Judging Criteria**](./judging.md) section. This page is the engineering companion to it: the real defects we found by running the system against live infrastructure, and how each was fixed.

Every item below was a genuine defect found while testing against live devnet transactions and a real TxLINE feed, not a theoretical risk written up in advance. This "write, run for real, find what's actually wrong, fix, re-verify" loop is the same discipline a production trading desk would expect.

## The incidents

- **The wallet balance monitor logged a warning but never actually paused anything.** The architecture called for pausing new commits gracefully before a wallet hit zero; an earlier build only warned. Fixed: the agent now tracks a real `paused` state, gated on the same threshold the monitor checks, blocking new commit attempts (never reveals already in flight) until the balance recovers.

- **A settlement race.** Because `MarketDataSource.onOdds`/`onScore` are fire-and-forget by design, a `game_finalised` event could be processed before every earlier commit for that fixture had actually landed, silently dropping their reveal/grade. Fixed by enqueuing the entire settlement as one atomic unit on the same serialized transaction queue used for commits, guaranteeing real FIFO order.

- **`ReconnectingSseClient` was implemented but never wired into `LiveTxLineSource`.** Found in a self-audit, not a crash. Fixed and confirmed against a real (not simulated) network timeout during a live-mode test: the process didn't die, and reconnected on its own.

- **A live fixture had no path to register itself in the database.** `signals.fixture_id` is a required foreign key into `tracked_fixtures`, but only the historical-backfill script ever wrote that table; the very first signal for a brand-new live fixture would have failed on the foreign-key constraint. Fixed: the agent now registers a fixture (fetching real team names best-effort, never blocking on it) the moment it sees the first event for a fixture it hasn't seen yet, and marks it `finished` the moment `game_finalised` is processed.

- **The public devnet RPC rate-limits aggressively under a burst of transactions.** Found running the agent loop against an accelerated replay, which naturally generates several commits in quick succession. Fixed with a serialized transaction queue with minimum spacing between publishes; for real production load, a dedicated RPC provider (Helius, QuickNode, etc.) would be the right call over the public endpoint.

- **The dashboard's "verified on-chain" badge was computed from a capped sample of 50 recent signals**, not the full graded set, a real if subtle violation of "never show a badge optimistically." Fixed by computing it server-side over every graded signal.

- **Solscan links were hardcoded to `cluster=devnet`**, which would have silently broken on a mainnet deploy. Fixed by driving the cluster from a single environment-configured constant, referenced everywhere instead of a literal string.

- **`grades.validation_proof_checked` could get stuck at `false` forever.** The on-chain `validateStatV2` cross-check only ran once, right when `game_finalised` arrived; if TxLINE hadn't yet anchored that day's Merkle root at that exact instant, the check failed and was never retried, permanently blocking the "verified on-chain" badge even though the signal itself graded correctly. Found against a real match that had finished only hours earlier in production. Fixed with a periodic sweep (`scheduleValidationRecheckSweep`, every 20 minutes) that retries every still-unchecked grade; confirmed against real production data, where it picked up the stuck fixture and flipped it to verified on the very first run after deploy.

- **The settle tail scales with signal volume.** During the live France × Spain semifinal, the aggressive agent committed **~6,400 signals**; because each reveal is its own paced on-chain transaction, draining that backlog after the whistle took roughly 3.5 hours, all unattended. It completes on its own, but batching reveals is the first hardening step we'd take for higher throughput.
- **Both agent VMs went dark mid-match, in two different ways, at the same time.** During the England × Argentina quarterfinal, `agent-aggressive`'s host ran out of memory — the kernel OOM-killed a routine `dnf-makecache` package-cache refresh, but the whole box stopped responding to network traffic (even `ping`) for ~3h — while `agent-conservative`'s process kept reporting `active` to systemd yet silently stopped doing anything: neither `connection.getBalance()` nor the `eventsource` SSE read loop had a timeout, so a transient network stall left a promise waiting forever on something that would never resolve or reject, freezing the whole event loop without ever crashing it. Found by noticing the dashboard's own signal feed had gone quiet, not by any alert. Fixed operationally first (reboot the OOM'd instance, restart the wedged process — any signal already detected-but-not-committed for the still-live fixture reconciled automatically on boot, since the fixture wasn't graded yet), then structurally: `getBalance()` and the SSE reader now both race an explicit timeout (15s / 90s), so a silent stall surfaces as an error within seconds instead of hanging indefinitely, letting the existing reconnect logic actually engage. Reconstructing TxLINE's historical odds for the blind window afterward confirmed `agent-conservative` almost certainly missed several real, threshold-crossing signals during the ~3.5h it was wedged — that gap is disclosed directly on the dashboard for this match instead of backfilled, since a signal committed after the result is knowable would defeat the entire premise of the project.

None of these were caught by code review alone. Every one surfaced by actually running the system against real infrastructure, then fixing what broke and re-verifying against real data again.


<div style={{textAlign:'center',margin:'2.2rem 0 0.5rem',opacity:0.9}}>
  <img src={require('@site/static/img/squirrels/rush-hop.gif').default} alt="" style={{height:'38px'}} />
</div>
