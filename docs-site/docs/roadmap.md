---
id: roadmap
title: Roadmap
sidebar_label: Roadmap
---

# Roadmap

## Shipped for the hackathon submission

- Two autonomous agents (`agent-aggressive`, `agent-conservative`) sharing one production loop, validated end-to-end against real World Cup devnet data.
- Full commit-reveal pipeline on Solana devnet via the SPL Memo Program, with a public, standalone verification tool.
- On-chain Merkle proof validation of both the graded result and the specific triggering odds tick (`validateStatV2` + `validateOdds`), not just the commit-reveal hash.
- Live and replay ingestion behind one identical `MarketDataSource` interface.
- A read-only dashboard with a live-feeling replay showcase, an in-app plain-language tutorial, and a public verify page.
- Idempotency, reconnection with backoff, wallet balance monitoring, and orphaned-signal reconciliation, all validated against real failure conditions, not just written and assumed correct.

## Next: a live match, start to finish

The agents are configured to run in **replay mode** for local testing and demoing (the World Cup's judging window falls after the tournament ends, so most evaluation happens in replay by design). The next concrete step is switching both agents to **live mode** ahead of an upcoming real match and letting the full pipeline run unattended from kickoff to final whistle, detection, commit, reveal, and grading all happening in real time against a match nobody has watched yet when the first signal fires. Once that match ends, its data becomes available as a second, independently-verifiable replay case alongside the one already in the dashboard, no backfill step needed, since it will have been captured live from the start.

## Considered, deliberately deferred

- **A dedicated Anchor program**, verifying the commit-reveal hash match on-chain inside the program itself rather than via an external verifier. Scoped from the start as the first thing to cut if the timeline tightened, the Memo Program alone is a complete, defensible submission, and building a custom program only made sense after the full pipeline was already proven with Memo. Worth revisiting post-hackathon if the "Logic & Architecture" upside is worth the audit surface.
- **A dedicated RPC provider** (Helius, QuickNode, or similar) in place of the public devnet endpoint, which rate-limits aggressively under bursts of transactions. Fine for a hackathon devnet deploy; the first real infrastructure upgrade before any mainnet or higher-volume run.
- **Fixture/odds Merkle validation** (`GET /api/fixtures/validation`, `GET /api/odds/validation` beyond the per-signal check already built), explicitly optional in the reference architecture; the score and triggering-odds-tick validation already in place cover the integrity claim that actually matters for the pitch.

## Beyond the hackathon

- **Mainnet deploy**, once the free-tier devnet validation window has run long enough to be confident in the pipeline under real economic stakes.
- **A third strategy** reading the same feed, to stress-test whether the "same data, different strategy" comparison stays honest at n=3 instead of n=2.
- **Historical leaderboard across multiple tournaments**, not just a single match's replay, the data model already supports it (everything is fixture-indexed); it's a dashboard aggregation feature away.
