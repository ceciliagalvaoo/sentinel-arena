import type { QueryResult, QueryResultRow } from "pg";
import { toOddsEvent, toScoreEvent, type RawOddsPayload, type RawScoreRecord } from "@sentinel/txline-client";
import { BaseMarketDataSource } from "./interface.js";

/** Structural subset of pg's Client/Pool — either works, nothing pg-specific beyond `.query()`. */
export interface QueryableDb {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

interface RecordedEventRow extends QueryResultRow {
  event_type: "odds" | "score";
  raw_payload: unknown;
  recorded_at: Date;
  sequence_index: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads a fixture's `recorded_events` (populated by
 * @sentinel/recorder-service's backfillFixture, or eventually a live
 * recorder) and re-emits them respecting the original inter-event timing,
 * scaled by `speedMultiplier`. Agent code sees the exact same
 * onOdds/onScore handlers as LiveTxLineSource — that equivalence is the
 * whole point (architecture doc section 2.2/8.2).
 */
export class ReplayDataSource extends BaseMarketDataSource {
  private stopped = false;

  constructor(
    private readonly db: QueryableDb,
    private readonly fixtureId: number,
    private readonly speedMultiplier = 1,
    /** Testing/debugging only — caps how many events are replayed. */
    private readonly maxEvents?: number,
    /** Testing/debugging only — skips to this sequence_index (e.g. to jump near a fixture's finalisation without replaying the whole match). */
    private readonly startIndex?: number,
  ) {
    super();
  }

  async start(): Promise<void> {
    this.stopped = false;
    const { rows } = await this.db.query<RecordedEventRow>(
      `SELECT event_type, raw_payload, recorded_at, sequence_index
       FROM recorded_events WHERE fixture_id = $1 ORDER BY sequence_index ASC`,
      [this.fixtureId],
    );

    if (rows.length === 0) {
      throw new Error(`No recorded events for fixture ${this.fixtureId} — run scripts/seed-replay-data.ts first`);
    }

    const sliced = this.startIndex !== undefined ? rows.filter((r) => r.sequence_index >= this.startIndex!) : rows;
    const events = this.maxEvents !== undefined ? sliced.slice(0, this.maxEvents) : sliced;
    let previousTs = events[0]!.recorded_at.getTime();

    for (const row of events) {
      if (this.stopped) return;

      const currentTs = row.recorded_at.getTime();
      const delta = (currentTs - previousTs) / this.speedMultiplier;
      if (delta > 0) await sleep(delta);
      previousTs = currentTs;

      if (row.event_type === "odds") {
        this.emitOdds(toOddsEvent(row.raw_payload as RawOddsPayload));
      } else {
        this.emitScore(toScoreEvent(row.raw_payload as RawScoreRecord));
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }
}
