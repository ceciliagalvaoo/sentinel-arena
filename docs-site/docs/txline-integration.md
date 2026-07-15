---
id: txline-integration
title: TxLINE Integration
sidebar_label: TxLINE Integration
---

# TxLINE Integration

TxLINE is TxODDS's Web3 product: a hybrid on-chain (Solana) / off-chain system delivering fixtures, odds, and scores with cryptographic verification via Merkle proofs anchored on Solana. Access is permissionless — pay in TxL (Token-2022) to unlock throughput, or use the free tier, which is what this project runs on.

## Why this only works with TxLINE, not any generic odds feed

It would be easy to build a version of this project against any ordinary odds/scores REST API and just add commit-reveal on top. That version would prove one thing: *the agent didn't alter its own signal after the fact.* It would not prove the more important thing underneath: *the market data the agent reacted to was itself genuine, unaltered TxODDS output, and the final score used to grade the signal was real.* Without that second proof, a "cryptographically verified" track record still ultimately rests on trusting the data provider's word — exactly the "trust us" gap this project exists to close (see [Judging Criteria → Innovation & Novelty](/criteria-innovation)).

TxLINE is what makes closing that whole gap possible, specifically because of three things a generic feed doesn't offer:

1. **On-chain Merkle roots for both Odds and Scores** (`daily_batch_roots`, `daily_scores_roots`, anchored on Solana), independently checkable via `validateOdds` / `validateStatV2`. This lets the grading engine attach a second, independent proof to every graded signal — not just "the agent's hash matches its own earlier commit," but "the specific odds tick that triggered this signal, and the specific final score used to grade it, are the exact data TxODDS published, unaltered." Two data providers publishing the same odds number is not the same claim; only one of them lets a third party check it on-chain without trusting either TxODDS or this project's own backend.
2. **Both proof layers live on the same chain as the commit-reveal mechanism.** Because TxLINE's data-integrity proofs and this project's decision-integrity proofs (SPL Memo commit-reveal) both anchor to Solana, a single verifier — Solscan, or this project's own public `/api/verify` tool — can chain them together into one unbroken proof: *genuine data in → genuine decision made before the result existed → genuine result used to grade it.* Pair TxLINE with a non-blockchain data source, or pair a blockchain-native data source that isn't TxLINE with a different chain, and that single-verifier chain breaks into two separately-trusted halves.
3. **Full-fidelity historical backfill via plain REST, for any finished fixture, at any time** (see the `startEpochDay` finding below) — not just a live stream. Judging happens after the World Cup ends, so the entire premise of a demonstrable Replay mode depends on being able to pull a *real* completed match's full tick-by-tick history after the fact, not a synthetic or truncated one. The 34,145 real odds ticks and 1,116 real score events backfilled for a single quarterfinal (see below) are what let Replay mode be indistinguishable from Live mode in the dashboard, rather than an obviously degraded fallback.

None of these three are things this project's own code contributes — they're properties of TxLINE specifically. Swap TxLINE for any other odds API and the commit-reveal half of this project still compiles and runs, but the actual differentiated claim — an accuracy track record that's unforgeable *all the way down to the underlying market data*, not just at the agent's own decision boundary — stops being true.

## Setup flow (once per wallet)

```
1. auth.start()               → POST /auth/guest/start                 → guest JWT
2. subscribe(serviceLevel=1)  → TxLINE's Anchor program, on-chain       → txSig
3. token.activate(txSig, [])  → POST /api/token/activate                → apiToken
```

`scripts/setup-subscription.ts` runs this once per agent wallet. One real gotcha the reference docs don't make obvious, only found by reading the official example repo (`tx-on-chain/examples/devnet/common/users.ts`): `subscribe()` requires the caller's Token-2022 Associated Token Account for the TxL mint to **already exist** before the call, even on the free tier where no token is actually charged.

## Endpoints used

| Endpoint | Used for |
|---|---|
| `POST /auth/guest/start` | Guest JWT |
| `subscribe()` (on-chain, Anchor) | One-time free-tier subscription |
| `POST /api/token/activate` | Activates the API token tied to the subscription |
| `GET /api/fixtures/snapshot` | Fixture metadata (participants, competition, start time) |
| `GET /api/scores/snapshot/{fixtureId}` | Current score state |
| `GET /api/odds/snapshot/{fixtureId}` (with `asOf`) | Odds state at a point in time |
| `GET /api/scores/historical/{fixtureId}` | Full score history for a finished fixture — **served as SSE**, not plain JSON (see below) |
| `GET /api/odds/updates/{epochDay}/{hourOfDay}/{interval}` | 5-minute-bucketed odds ticks, used to backfill replay data |
| `GET /api/scores/updates/{epochDay}/{hourOfDay}/{interval}` | Same, for scores |
| `GET /api/odds/stream` | Live SSE odds feed — the primary agent input in live mode |
| `GET /api/scores/stream` | Live SSE score feed — how agents detect `game_finalised` in live mode |
| `GET /api/scores/stat-validation` (`validateStatV2`) | Merkle proof of a score stat, checked on-chain |
| `GET /api/odds/validation` (`validateOdds`) | Merkle proof of a specific odds tick, checked on-chain |

`GET /api/fixtures/validation` was left unpursued deliberately — it's explicitly optional in the reference architecture, and the score-validation + odds-validation pair above already covers what matters for the integrity claim (a commit never depends on a proof being available in the first place — see [Architecture](/architecture)).

## Real findings from building against the live API

These are drawn from this project's development log — every entry below is a genuine surprise encountered while integrating, not a hypothetical.

- **`GET /api/scores/historical/{fixtureId}` responds `Content-Type: text/event-stream`**, formatted as SSE records (`data: {...}\nid: N\n\n`) rather than a plain JSON array — unlike every other snapshot/updates endpoint, which returns normal `application/json`. Not flagged anywhere in the OpenAPI reference; only discovered by inspecting the raw response body after `response.json()` failed outright.
- **`GET /api/fixtures/snapshot` only returns fixtures from `startEpochDay` forward** (default: today) — a bare call after the World Cup's mapped phase had ended returned nothing. Passing the correct `startEpochDay`, or querying `odds/snapshot/{fixtureId}` / `scores/snapshot/{fixtureId}` directly with a known `fixtureId`, returns the real, complete tournament data on devnet regardless of match date. This materially changed the replay-mode design: rather than only recording live events (risky — depends on catching a match in progress), a **full historical backfill via REST** is possible for any finished fixture, at any time, which substantially de-risked the hackathon's judging calendar.
- **Backfilling one real World Cup fixture (France vs. Morocco, quarterfinal) produced 1,116 score events and 34,145 odds events** — far higher volume than expected for a single match, because StablePrice updates many markets/houses in parallel. The `odds/updates/{epochDay}/{hourOfDay}/{interval}` endpoint correctly filters by `fixtureId` (confirmed: all 751 records returned in a sampled 5-minute bucket belonged to the same fixture). A subtle trap: anchoring the odds backfill window on the *earliest* `Ts` seen in `scores/historical` overshoots badly, because score coverage can begin days before kickoff (`coverage_update` events) with no odds ticking yet at that point — the fix was anchoring on the score record's own `StartTime` field instead.
- **`GET /api/odds/stream` connects and stays stable with automatic JWT renewal wired in** (via the `eventsource` package with a custom `fetch`, matching the official example repo's pattern) — confirmed holding a clean connection with no errors even with no live match in progress (silence/heartbeat only, as documented).
- **The reference doc's `validateStatV2` payload example is illustrative only** — real field names only match exactly what's in the vendored IDL (`idl/devnet/txoracle.json`). A wrong field name here doesn't produce a TypeScript error (the client is typed against the generic `anchor.Idl`, not a literal generated type) — it only fails at runtime during on-chain deserialization. Every struct (`StatValidationInput`, `ScoresBatchSummary`, `StatLeaf`, `NDimensionalStrategy`, `StatPredicate`, `TraderPredicate`) was checked field-by-field against the IDL before writing the client.
- **`validateOdds` has a stricter timestamp requirement than `validateStatV2`.** For scores, the `ts` argument is the batch summary's `minTimestamp`. For odds, it must be **exactly** the individual tick's own `ts` — using the batch minimum fails on-chain with `AnchorError: TimestampMismatch`. Not documented anywhere; only found by testing against devnet directly.

For the full, dated log (a required submission deliverable), see [TxLINE API Feedback Log](/txline-feedback-log).
