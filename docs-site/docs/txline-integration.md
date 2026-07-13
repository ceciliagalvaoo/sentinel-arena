---
id: txline-integration
title: TxLINE Integration
sidebar_label: TxLINE Integration
---

# TxLINE Integration

TxLINE is TxODDS's Web3 product: a hybrid on-chain (Solana) / off-chain system delivering fixtures, odds, and scores with cryptographic verification via Merkle proofs anchored on Solana. Access is permissionless — pay in TxL (Token-2022) to unlock throughput, or use the free tier, which is what this project runs on.

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
