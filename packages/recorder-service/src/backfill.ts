import type { AxiosInstance } from "axios";
import type { QueryResult, QueryResultRow } from "pg";
import {
  fetchFixturesSnapshot,
  fetchOddsUpdatesByInterval,
  fetchScoresHistorical,
  type RawFixture,
  type RawOddsPayload,
} from "@sentinel/txline-client";

export interface BackfillResult {
  fixtureId: number;
  scoreEventCount: number;
  oddsEventCount: number;
  totalInserted: number;
  fixture: RawFixture | null;
}

/**
 * Structural subset of pg's `Client` — deliberately not the concrete `Client`
 * type, since this runs a `BEGIN`/`COMMIT`/`ROLLBACK` transaction and needs
 * one dedicated connection either way. A `PoolClient` (from `pool.connect()`)
 * satisfies this just as well as a plain `Client` does; the concrete `Client`
 * type unnecessarily rejected `PoolClient` on properties this code never
 * touches (host, port, ssl, ...).
 */
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

interface Bucket {
  epochDay: number;
  hourOfDay: number;
  interval: number;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function epochDayOf(ts: number): number {
  return Math.floor(ts / 86_400_000);
}

function hourOfDayOf(ts: number): number {
  return new Date(ts).getUTCHours();
}

function intervalOf(ts: number): number {
  return Math.floor(new Date(ts).getUTCMinutes() / 5);
}

/** Enumerate distinct 5-minute (epochDay, hourOfDay, interval) buckets spanning [startTs, endTs]. */
function enumerateBuckets(startTs: number, endTs: number): Bucket[] {
  const buckets: Bucket[] = [];
  const seen = new Set<string>();
  for (let ts = startTs; ts <= endTs; ts += FIVE_MINUTES_MS) {
    const bucket: Bucket = { epochDay: epochDayOf(ts), hourOfDay: hourOfDayOf(ts), interval: intervalOf(ts) };
    const key = `${bucket.epochDay}:${bucket.hourOfDay}:${bucket.interval}`;
    if (!seen.has(key)) {
      seen.add(key);
      buckets.push(bucket);
    }
  }
  return buckets;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index] as T, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

interface RecordedEventInsert {
  fixtureId: number;
  eventType: "odds" | "score";
  payload: unknown;
  ts: number;
  sequenceIndex: number;
}

async function insertRecordedEventsBatched(db: Queryable, rows: RecordedEventInsert[], batchSize = 500): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const chunk = rows.slice(offset, offset + batchSize);
    const values: unknown[] = [];
    const placeholders = chunk.map((row, i) => {
      const base = i * 5;
      values.push(row.fixtureId, row.eventType, JSON.stringify(row.payload), row.ts, row.sequenceIndex);
      return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, to_timestamp($${base + 4}::double precision / 1000.0), $${base + 5})`;
    });
    await db.query(
      `INSERT INTO recorded_events (fixture_id, event_type, raw_payload, recorded_at, sequence_index) VALUES ${placeholders.join(", ")}`,
      values,
    );
  }
}

/**
 * Backfills a completed fixture's full Scores + Odds history into
 * `recorded_events`, driving it entirely from REST (no live SSE needed).
 * Discovered 2026-07-12: TxLINE's devnet free tier serves the World Cup's
 * real historical odds/scores regardless of whether the match is live right
 * now, which de-risks replay mode against the hackathon's judging calendar
 * (Copa already over by the time judges evaluate — see architecture doc
 * section 0.2).
 *
 * Re-runnable: replaces any previously recorded events for this fixtureId.
 */
export async function backfillFixture(params: {
  apiClient: AxiosInstance;
  db: Queryable;
  fixtureId: number;
  /** Minutes of pre/post-match buffer for the odds window. Default 15. */
  bufferMinutes?: number;
}): Promise<BackfillResult> {
  const { apiClient, db, fixtureId, bufferMinutes = 15 } = params;
  const bufferMs = bufferMinutes * 60 * 1000;

  const scores = await fetchScoresHistorical(apiClient, fixtureId);
  if (scores.length === 0) {
    throw new Error(
      `No historical scores for fixture ${fixtureId} — must have started between 2 weeks and 6h ago, and have coverage.`,
    );
  }

  const startTime = typeof scores[0]?.StartTime === "number" ? scores[0].StartTime : undefined;
  const scoreTsValues = scores.map((s) => s.Ts);
  const maxScoreTs = Math.max(...scoreTsValues);
  // Use the match's own StartTime (not the earliest score Ts) as the odds
  // window floor — early "coverage_update" records can precede kickoff by
  // days and would otherwise blow up the bucket count for no benefit.
  const windowStartTs = (startTime ?? Math.min(...scoreTsValues)) - bufferMs;
  const windowEndTs = maxScoreTs + bufferMs;

  let fixture: RawFixture | null = null;
  if (startTime) {
    const fixtures = await fetchFixturesSnapshot(apiClient, { startEpochDay: epochDayOf(startTime) });
    fixture = fixtures.find((f) => f.FixtureId === fixtureId) ?? null;
  }

  const buckets = enumerateBuckets(windowStartTs, windowEndTs);
  const oddsBatches = await mapWithConcurrency(buckets, 5, (bucket) =>
    fetchOddsUpdatesByInterval(apiClient, bucket.epochDay, bucket.hourOfDay, bucket.interval, fixtureId),
  );
  const odds: RawOddsPayload[] = oddsBatches.flat();

  // Bucket boundaries can overlap server-side; de-dupe by MessageId.
  const seenMessageIds = new Set<string>();
  const dedupedOdds = odds.filter((o) => {
    if (seenMessageIds.has(o.MessageId)) return false;
    seenMessageIds.add(o.MessageId);
    return true;
  });

  const merged = [
    ...scores.map((payload) => ({ eventType: "score" as const, ts: payload.Ts, payload })),
    ...dedupedOdds.map((payload) => ({ eventType: "odds" as const, ts: payload.Ts, payload })),
  ].sort((a, b) => a.ts - b.ts);

  // captured_live=false: this fixture's data (and every signal built on top
  // of it) was reconstructed after the fact via REST, not observed tick-by-
  // tick as it happened — see migration 0003 for why the dashboard needs to
  // know that, distinct from "live" (packages/agent-runtime's upsertLiveFixture).
  await db.query(
    `INSERT INTO tracked_fixtures (fixture_id, competition, participant1, participant2, start_time, status, captured_live)
     VALUES ($1, $2, $3, $4, ${fixture?.StartTime ? "to_timestamp($5::double precision / 1000.0)" : "NULL"}, 'finished', false)
     ON CONFLICT (fixture_id) DO UPDATE SET status = 'finished', captured_live = false, competition = COALESCE(EXCLUDED.competition, tracked_fixtures.competition)`,
    fixture
      ? [fixtureId, fixture.Competition, fixture.Participant1, fixture.Participant2, fixture.StartTime]
      : [fixtureId, null, null, null],
  );

  await db.query("BEGIN");
  try {
    await db.query("DELETE FROM recorded_events WHERE fixture_id = $1", [fixtureId]);
    const rows: RecordedEventInsert[] = merged.map((event, sequenceIndex) => ({
      fixtureId,
      eventType: event.eventType,
      payload: event.payload,
      ts: event.ts,
      sequenceIndex,
    }));
    await insertRecordedEventsBatched(db, rows);
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }

  return {
    fixtureId,
    scoreEventCount: scores.length,
    oddsEventCount: dedupedOdds.length,
    totalInserted: merged.length,
    fixture,
  };
}
