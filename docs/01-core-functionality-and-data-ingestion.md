<p align="center">
  <img src="img/rush.gif" alt="Rush, the aggressive agent" height="100" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/logo.png" alt="Sentinel Arena" height="78" />
  &nbsp;&nbsp;&nbsp;
  <img src="img/sage.gif" alt="Sage, the conservative agent" height="100" />
</p>

# 1 · Core Functionality & Data Ingestion

> *Does the robot run stably, consuming TxLINE's data (real or simulated) without choking?*

## The short answer

Yes, and we can prove it with a real match. On **July 14–15, 2026**, we watched Sentinel Arena's agents consume the live TxLINE feed for the World Cup semifinal **France × Spain** from kickoff to full-time. During roughly two hours of play, the two agents ingested the odds stream continuously and committed **over eight thousand signals** between them, without a single stall and with the backend answering health checks in **under one second** the entire time. Nothing was fed to them by hand; they simply drank from the feed and worked.

This page explains how that ingestion pipeline is built, and why it stays on its feet when the feed gets noisy.

## Two streams, one heartbeat

TxLINE exposes World Cup data as two independent **Server-Sent Event (SSE)** streams, one for odds, one for scores. Sentinel Arena subscribes to both and treats them as the raw material for everything downstream: odds movements trigger predictions, and the score stream's final-whistle event triggers settlement.

Ingestion is deliberately abstracted behind a single interface, `MarketDataSource`, with two interchangeable implementations:

- **`LiveTxLineSource`**, the real thing: it authenticates with a guest JWT, opens both SSE streams, and forwards every tick to the agent loop.
- **`ReplayDataSource`**, the same interface, but fed from odds and scores that were previously recorded to the database. This is what keeps the product demonstrable *after* a match ends, at zero cost and with byte-for-byte the same behaviour.

Because both sources satisfy the same contract, the agent's decision logic never knows, or cares, whether it is reading a live World Cup match or a faithful replay. That single abstraction is what lets the judging happen in **Replay** mode with exactly the code path that ran live.

<p align="center"><b>Figure 1 - Live/Replay is a first-class toggle, next to the fixture selector and the connection status</b></p>

<p align="center">
  <img src="img/header.png" alt="The dashboard header showing the fixture selector, country flags, the LIVE/REPLAY toggle and the connection indicator" width="760" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## Staying on its feet when the feed wobbles

A live sports feed is not a calm thing. Connections drop, markets go silent between plays, and volatile moments produce bursts of ticks. A naïve consumer chokes on all three. Sentinel Arena was hardened against each:

- **Every drop is treated as fatal for that attempt.** Rather than trusting the underlying SSE library's internal retries, the source closes the connection itself and hands all retry timing to a dedicated `ReconnectingSseClient`, which reconnects with **exponential backoff**. The odds and scores streams reconnect independently, since either can drop without the other.
- **Silence is a normal state, not a failure.** A successful connection only means the credentials were accepted; it does not guarantee the covered fixtures are producing data at that instant. The system expects long quiet stretches punctuated by heartbeats and does not panic during them.
- **Bursts never overwhelm the pipeline.** Detection (updating the moving window and the threshold) stays synchronous and un-queued so it can never fall behind the feed. Only the expensive part, publishing a transaction to Solana, is serialized through a queue, so a flurry of simultaneous signals cannot fire a storm of concurrent blockchain calls and get rate-limited.

The practical result is a consumer that keeps its footing through exactly the conditions that break naïve bots.

## What "ingesting a tick" actually does

For every odds message that matches the tracked market (soccer 1X2, home win, draw, away win), the agent:

1. Extracts the implied percentage for each outcome.
2. Pushes it into a **time-bounded moving window** (60 seconds for Rush, 180 for Sage).
3. Computes the percentage change since the start of that window.
4. Feeds that change to an **auto-calibrated threshold** (detailed in [§3 Logic & Architecture](./03-logic-and-architecture.md)).
5. Fires a signal only when the move is sharp enough to clear the threshold.

The volume this produces is real. In the France × Spain match, the aggressive agent's window-and-threshold machine turned the live feed into **thousands of committed signals**, each one a genuine reaction to a genuine market move.

<p align="center"><b>Figure 2 - Rush's live event feed: every row is one ingested market move, committed on-chain</b></p>

<p align="center">
  <img src="img/agent-card-rush.png" alt="Rush's agent card showing accuracy, the pixel progress bar and a long event feed of commit-to-reveal rows" width="380" />
</p>

<p align="center"><sub>Source: The authors (2026)</sub></p>

## Never blocking the core on an optional lookup

A recurring design rule keeps ingestion robust: **an optional enrichment must never block the core pipeline.** Fetching a fixture's team names and competition is best-effort, if that lookup fails, the agent still registers a bare fixture row and keeps detecting signals. The same discipline applies to on-chain proof cross-checks: they enrich the record when available, but a missing proof never stalls a commit. The feed keeps flowing no matter what the periphery is doing.

## Feedback on the TxLINE API

Working against a live, in-development feed surfaced real integration lessons, which we kept in a running log from day one (see [`docs-site`](../docs-site) → *TxLINE API feedback log*). Two are worth highlighting here because they shaped the ingestion design:

- **Historical scores are only served for fixtures that started between roughly 6 hours and 2 weeks ago.** Calling that endpoint the instant a match finishes fails, the data is not there yet. We adapted by polling periodically for finished-and-old-enough fixtures rather than firing a one-shot request at full-time.
- **A successful SSE connection is not a guarantee of data.** This pushed us toward the "silence is normal, every drop is fatal-for-this-attempt" reconnection model above.

## Why this satisfies the criterion

The robot **runs stably on the real feed**, proven on a live World Cup match; it **handles the messy realities** of a sports stream, drops, silence, bursts, by design rather than by luck; and it exposes the exact same code path in **Replay** so the behaviour is reproducible for any judge, at any time, at no cost. The data ingestion is not a demo prop. It is the load-bearing floor of the whole product.

---

*Next: [2 · Autonomous Operation →](./02-autonomous-operation.md)*
