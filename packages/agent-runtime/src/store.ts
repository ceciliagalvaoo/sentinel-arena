import type { QueryResult, QueryResultRow } from "pg";
import type { AgentAccuracy, SignalPayload } from "@sentinel/shared-types";

/** Structural subset of pg's Client/Pool — either works. */
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";
}

export interface SignalRecordInput {
  id: string;
  agentId: string;
  fixtureId: number;
  outcomeKey: string;
  oddsMessageId: string;
  oddsTs: number;
  pctBefore: number;
  pctAfter: number;
  pctChange: number;
  payload: SignalPayload;
  payloadHash: string;
  idempotencyKey: string;
}

export interface PendingSignal extends QueryResultRow {
  id: string;
  agent_id: string;
  outcome_key: string;
  payload_json: SignalPayload;
  commit_tx_sig: string;
}

export interface OrphanedSignal extends QueryResultRow {
  id: string;
  fixture_id: string;
  payload_hash: string;
}

export interface UnrecoverableOrphanedSignal extends QueryResultRow {
  id: string;
  fixture_id: string;
}

export interface GradeNeedingValidationRecheck extends QueryResultRow {
  fixture_id: number;
  scores_seq_used: number;
  final_outcome: string;
}

/** Postgres-backed persistence for the signal lifecycle (signals -> commits -> reveals -> grades). */
export class SignalStore {
  constructor(private readonly db: Queryable) {}

  /**
   * `signals.fixture_id` has a NOT NULL foreign key into `tracked_fixtures`
   * — in LIVE mode nothing else ever creates that row (only the backfill
   * script does, and only for already-finished fixtures), so without this
   * the very first signal for a genuinely new live fixture would fail on
   * the FK constraint. Also the only thing that makes a live match show up
   * in the dashboard's "Live" fixture selector at all (it filters on
   * status='live'). Idempotent — safe to call on every event, but callers
   * should still dedupe per fixtureId to avoid a redundant UPDATE per tick.
   */
  async upsertLiveFixture(
    fixtureId: number,
    participant1: string | null,
    participant2: string | null,
    competition: string | null,
    startTimeMs: number | null,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO tracked_fixtures (fixture_id, competition, participant1, participant2, start_time, status)
       VALUES ($1, $2, $3, $4, ${startTimeMs !== null ? "to_timestamp($5::double precision / 1000.0)" : "NULL"}, 'live')
       ON CONFLICT (fixture_id) DO UPDATE SET
         status = CASE WHEN tracked_fixtures.status = 'finished' THEN tracked_fixtures.status ELSE 'live' END,
         participant1 = COALESCE(tracked_fixtures.participant1, EXCLUDED.participant1),
         participant2 = COALESCE(tracked_fixtures.participant2, EXCLUDED.participant2),
         competition = COALESCE(tracked_fixtures.competition, EXCLUDED.competition)`,
      startTimeMs !== null
        ? [fixtureId, competition, participant1, participant2, startTimeMs]
        : [fixtureId, competition, participant1, participant2],
    );
  }

  /** Called once a fixture's game_finalised is processed — closes the live→finished loop without needing a manual backfill run afterward. */
  async markFixtureFinished(fixtureId: number): Promise<void> {
    await this.db.query(`UPDATE tracked_fixtures SET status = 'finished' WHERE fixture_id = $1`, [fixtureId]);
  }

  /**
   * Finished fixtures with no `recorded_events` yet, old enough for
   * `GET /api/scores/historical` to actually have data (TxLINE only serves
   * that endpoint for fixtures that started between 6h and 2 weeks ago —
   * see docs/txline-integration.md). A fixture that just finished a moment
   * ago is deliberately excluded here; the periodic sweep that calls this
   * (see apps/agent-aggressive/src/index.ts) picks it up once enough time
   * has passed, with no in-memory timer to lose across a process restart.
   */
  async findFixturesNeedingReplayBackfill(): Promise<{ fixture_id: number }[]> {
    const { rows } = await this.db.query<{ fixture_id: number }>(
      `SELECT tf.fixture_id
       FROM tracked_fixtures tf
       WHERE tf.status = 'finished'
         AND tf.start_time IS NOT NULL
         AND tf.start_time < now() - interval '6 hours'
         AND NOT EXISTS (SELECT 1 FROM recorded_events re WHERE re.fixture_id = tf.fixture_id)`,
    );
    return rows;
  }

  /** Returns false (not an error) if this exact agent+event+outcome was already recorded — the idempotency guard. */
  async tryCreateSignal(input: SignalRecordInput): Promise<boolean> {
    try {
      await this.db.query(
        `INSERT INTO signals (id, agent_id, fixture_id, outcome_key, odds_message_id, odds_ts, pct_before, pct_after, pct_change, payload_json, payload_hash, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
        [
          input.id,
          input.agentId,
          input.fixtureId,
          input.outcomeKey,
          input.oddsMessageId,
          input.oddsTs,
          input.pctBefore,
          input.pctAfter,
          input.pctChange,
          JSON.stringify(input.payload),
          input.payloadHash,
          input.idempotencyKey,
        ],
      );
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  async insertCommit(signalId: string, commitTxSig: string, commitSlot: number | null): Promise<void> {
    await this.db.query(`INSERT INTO commits (signal_id, commit_tx_sig, commit_slot) VALUES ($1, $2, $3)`, [
      signalId,
      commitTxSig,
      commitSlot,
    ]);
  }

  /**
   * Signals with no `commits` row — crashed between `tryCreateSignal` and
   * `publishCommit` (e.g. process killed mid-flight). Safe to reconcile:
   * the payload was frozen and hashed at detection time, so publishing the
   * SAME hash late doesn't change what's being claimed, only when the
   * commit transaction lands — which is exactly why fixtures that already
   * have a grade are excluded here (a commit published after the result is
   * known is worthless as a predictive claim, no matter how honest the
   * hash is). Those go to `findUnrecoverableOrphanedSignals` instead.
   */
  async findOrphanedSignals(agentId: string): Promise<OrphanedSignal[]> {
    const { rows } = await this.db.query<OrphanedSignal>(
      `SELECT s.id, s.fixture_id, s.payload_hash
       FROM signals s
       LEFT JOIN commits c ON c.signal_id = s.id
       WHERE s.agent_id = $1
         AND c.signal_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM grades g
           JOIN signals s2 ON s2.id = g.signal_id
           WHERE s2.agent_id = s.agent_id AND s2.fixture_id = s.fixture_id
         )`,
      [agentId],
    );
    return rows;
  }

  /** Orphaned signals whose fixture was already graded — too late to commit honestly, kept only for visibility/audit. */
  async findUnrecoverableOrphanedSignals(agentId: string): Promise<UnrecoverableOrphanedSignal[]> {
    const { rows } = await this.db.query<UnrecoverableOrphanedSignal>(
      `SELECT s.id, s.fixture_id
       FROM signals s
       LEFT JOIN commits c ON c.signal_id = s.id
       WHERE s.agent_id = $1
         AND c.signal_id IS NULL
         AND EXISTS (
           SELECT 1 FROM grades g
           JOIN signals s2 ON s2.id = g.signal_id
           WHERE s2.agent_id = s.agent_id AND s2.fixture_id = s.fixture_id
         )`,
      [agentId],
    );
    return rows;
  }

  /**
   * This agent's signals for this fixture that have a commit but no grade
   * yet — what game_finalised needs to settle. Ordered by detection time:
   * without it Postgres returns pending rows in whatever order its query
   * plan picks, not chronological, which settled a real match (Spain x
   * Argentina, 2026-07-19) with reveals landing in a visibly scattered
   * order — a signal detected minutes before full-time graded before ones
   * from days earlier in the pre-match window. Harmless to the on-chain
   * proof itself (each reveal is still independently correct), but it made
   * the dashboard's cumulative-accuracy chart, which plots by detection
   * time, fill in out of sequence instead of building up steadily as
   * settlement drains the queue.
   */
  async findPendingSignalsByFixture(fixtureId: number, agentId: string): Promise<PendingSignal[]> {
    const { rows } = await this.db.query<PendingSignal>(
      `SELECT s.id, s.agent_id, s.outcome_key, s.payload_json, c.commit_tx_sig
       FROM signals s
       JOIN commits c ON c.signal_id = s.id
       LEFT JOIN grades g ON g.signal_id = s.id
       WHERE s.fixture_id = $1 AND s.agent_id = $2 AND g.signal_id IS NULL
       ORDER BY s.detected_at ASC`,
      [fixtureId, agentId],
    );
    return rows;
  }

  async insertReveal(signalId: string, revealTxSig: string, hashVerified: boolean): Promise<void> {
    await this.db.query(`INSERT INTO reveals (signal_id, reveal_tx_sig, hash_verified) VALUES ($1, $2, $3)`, [
      signalId,
      revealTxSig,
      hashVerified,
    ]);
  }

  async insertGrade(
    signalId: string,
    finalOutcome: string,
    correct: boolean,
    scoresSeqUsed: number,
    validationProofChecked: boolean,
    oddsProofChecked: boolean,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO grades (signal_id, final_outcome, correct, scores_seq_used, validation_proof_checked, odds_proof_checked) VALUES ($1, $2, $3, $4, $5, $6)`,
      [signalId, finalOutcome, correct, scoresSeqUsed, validationProofChecked, oddsProofChecked],
    );
  }

  /**
   * `checkValidationProof` (loop.ts) only gets one shot, right when
   * `game_finalised` arrives — if TxLINE hadn't anchored that day's Merkle
   * root on-chain yet at that exact moment, the on-chain check fails and
   * `validation_proof_checked` is stuck at `false` forever with no retry.
   * One row per fixture (not per signal): every pending signal on the same
   * fixture graded against the same final score, so the on-chain result is
   * identical for all of them — no need to re-check each one individually.
   */
  async findGradesNeedingValidationRecheck(): Promise<GradeNeedingValidationRecheck[]> {
    const { rows } = await this.db.query<GradeNeedingValidationRecheck>(
      `SELECT DISTINCT s.fixture_id, g.scores_seq_used, g.final_outcome
       FROM grades g
       JOIN signals s ON s.id = g.signal_id
       WHERE g.validation_proof_checked = false`,
    );
    return rows;
  }

  /** Flips every still-unchecked grade for this fixture to checked, across both agents — the recheck result is fixture-wide, not agent-specific. */
  async markFixtureGradesValidationChecked(fixtureId: number): Promise<void> {
    await this.db.query(
      `UPDATE grades g
       SET validation_proof_checked = true
       FROM signals s
       WHERE g.signal_id = s.id AND s.fixture_id = $1 AND g.validation_proof_checked = false`,
      [fixtureId],
    );
  }

  async getAgentAccuracy(agentId: string): Promise<AgentAccuracy> {
    const { rows } = await this.db.query<{ correct_signals: string; total_graded_signals: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE g.correct) AS correct_signals,
         COUNT(*) AS total_graded_signals
       FROM grades g
       JOIN signals s ON s.id = g.signal_id
       WHERE s.agent_id = $1`,
      [agentId],
    );
    const row = rows[0];
    const correctSignals = Number(row?.correct_signals ?? 0);
    const totalGradedSignals = Number(row?.total_graded_signals ?? 0);
    return {
      agentId,
      correctSignals,
      totalGradedSignals,
      accuracy: totalGradedSignals === 0 ? 0 : correctSignals / totalGradedSignals,
    };
  }
}
