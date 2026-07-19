import { Pool } from "pg";
import {
  type AgentAccuracy,
  type AgentId,
  type AgentRow,
  type CommitRow,
  type FixtureStatus,
  type GradeRow,
  type RevealRow,
  type SignalRow,
  type SignalWithLifecycle,
  type TrackedFixtureRow,
  resolveDatabaseSsl,
} from "@sentinel/shared-types";

export function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString, ssl: resolveDatabaseSsl(connectionString) });
}

interface AgentDbRow {
  id: AgentId;
  strategy_name: string;
  sensitivity_multiplier: string;
  window_seconds: number;
  warmup_readings: number;
  wallet_pubkey: string;
  created_at: Date;
}

function mapAgent(row: AgentDbRow): AgentRow {
  return {
    id: row.id,
    strategyName: row.strategy_name,
    sensitivityMultiplier: Number(row.sensitivity_multiplier),
    windowSeconds: row.window_seconds,
    warmupReadings: row.warmup_readings,
    walletPubkey: row.wallet_pubkey,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getAgent(pool: Pool, agentId: string): Promise<AgentRow | null> {
  const { rows } = await pool.query<AgentDbRow>(`SELECT * FROM agents WHERE id = $1`, [agentId]);
  return rows[0] ? mapAgent(rows[0]) : null;
}

export async function listAgents(pool: Pool): Promise<AgentRow[]> {
  const { rows } = await pool.query<AgentDbRow>(`SELECT * FROM agents ORDER BY id`);
  return rows.map(mapAgent);
}

export async function getAgentAccuracy(pool: Pool, agentId: string): Promise<AgentAccuracy> {
  // Scoped to World Cup fixtures only. This is a World Cup product, but the
  // agents register any soccer fixture they see odds for (e.g. friendlies the
  // live feed carries once the tournament is over). Without the tracked_fixtures
  // join + competition filter, those non-tournament matches would be counted
  // into the headline accuracy once they finish and grade, silently polluting
  // the number the dashboard shows. Read-only aggregate; no agent/pipeline change.
  const { rows } = await pool.query<{ correct_signals: string; total_graded_signals: string; unchecked_signals: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE g.correct) AS correct_signals,
       COUNT(*) AS total_graded_signals,
       COUNT(*) FILTER (WHERE NOT g.validation_proof_checked) AS unchecked_signals
     FROM grades g
     JOIN signals s ON s.id = g.signal_id
     JOIN tracked_fixtures tf ON tf.fixture_id = s.fixture_id
     WHERE s.agent_id = $1
       AND tf.competition ILIKE 'World Cup'`,
    [agentId],
  );
  const row = rows[0];
  const correctSignals = Number(row?.correct_signals ?? 0);
  const totalGradedSignals = Number(row?.total_graded_signals ?? 0);
  const uncheckedSignals = Number(row?.unchecked_signals ?? 0);
  return {
    agentId,
    correctSignals,
    totalGradedSignals,
    accuracy: totalGradedSignals === 0 ? 0 : correctSignals / totalGradedSignals,
    // Computed over EVERY graded signal, not a recent sample — see the type's docstring.
    allValidationChecked: totalGradedSignals > 0 && uncheckedSignals === 0,
  };
}

interface TrackedFixtureDbRow {
  fixture_id: string;
  competition: string | null;
  participant1: string | null;
  participant2: string | null;
  start_time: Date | null;
  status: FixtureStatus;
  captured_live: boolean;
}

function mapFixture(row: TrackedFixtureDbRow): TrackedFixtureRow {
  return {
    fixtureId: Number(row.fixture_id),
    competition: row.competition,
    participant1: row.participant1,
    participant2: row.participant2,
    startTime: row.start_time ? row.start_time.toISOString() : null,
    status: row.status,
    capturedLive: row.captured_live,
  };
}

// Scoped to World Cup fixtures only, same reasoning as getAgentAccuracy above.
// bd54152 filtered this client-side in the dashboard, but GET /api/fixtures
// itself was untouched, so any direct caller (not just the dashboard UI)
// could still see non-tournament fixtures the agents registered. The agents
// themselves no longer even create rows for confirmed non-World-Cup
// fixtures (agent-runtime's ensureFixtureRegistered), so this is now mostly
// a filter against pre-existing rows, not the primary guard.
export async function listTrackedFixtures(pool: Pool): Promise<TrackedFixtureRow[]> {
  const { rows } = await pool.query<TrackedFixtureDbRow>(
    `SELECT * FROM tracked_fixtures WHERE competition ILIKE 'World Cup' ORDER BY start_time DESC NULLS LAST`,
  );
  return rows.map(mapFixture);
}

interface SignalFeedDbRow {
  id: string;
  agent_id: AgentId;
  fixture_id: string;
  outcome_key: string;
  odds_message_id: string;
  odds_ts: string;
  pct_before: string;
  pct_after: string;
  pct_change: string;
  detected_at: Date;
  payload_json: Record<string, unknown>;
  payload_hash: string;
  idempotency_key: string;
  commit_tx_sig: string | null;
  commit_slot: string | null;
  committed_at: Date | null;
  reveal_tx_sig: string | null;
  revealed_at: Date | null;
  hash_verified: boolean | null;
  final_outcome: string | null;
  correct: boolean | null;
  scores_seq_used: number | null;
  validation_proof_checked: boolean | null;
  odds_proof_checked: boolean | null;
  graded_at: Date | null;
}

function mapSignalFeedRow(row: SignalFeedDbRow): SignalWithLifecycle {
  const signal: SignalRow = {
    id: row.id,
    agentId: row.agent_id,
    fixtureId: Number(row.fixture_id),
    outcomeKey: row.outcome_key,
    oddsMessageId: row.odds_message_id,
    oddsTs: Number(row.odds_ts),
    pctBefore: Number(row.pct_before),
    pctAfter: Number(row.pct_after),
    pctChange: Number(row.pct_change),
    detectedAt: row.detected_at.toISOString(),
    payloadJson: row.payload_json,
    payloadHash: row.payload_hash,
    idempotencyKey: row.idempotency_key,
  };

  const commit: CommitRow | null = row.commit_tx_sig
    ? {
        signalId: row.id,
        commitTxSig: row.commit_tx_sig,
        commitSlot: row.commit_slot ? Number(row.commit_slot) : null,
        committedAt: row.committed_at!.toISOString(),
      }
    : null;

  const reveal: RevealRow | null = row.reveal_tx_sig
    ? {
        signalId: row.id,
        revealTxSig: row.reveal_tx_sig,
        revealedAt: row.revealed_at!.toISOString(),
        hashVerified: row.hash_verified!,
      }
    : null;

  const grade: GradeRow | null = row.final_outcome
    ? {
        signalId: row.id,
        finalOutcome: row.final_outcome,
        correct: row.correct!,
        scoresSeqUsed: row.scores_seq_used!,
        validationProofChecked: row.validation_proof_checked!,
        oddsProofChecked: row.odds_proof_checked!,
        gradedAt: row.graded_at!.toISOString(),
      }
    : null;

  return { ...signal, commit, reveal, grade };
}

// Joins tracked_fixtures (signals.fixture_id is a NOT NULL FK into it, so
// an inner join drops nothing) and both consumers below require
// competition ILIKE 'World Cup' unconditionally, same reasoning as
// listTrackedFixtures/getAgentAccuracy: neither GET /api/signals nor the
// WebSocket push (listSignalFeedUpdatedSince) should surface a
// non-tournament fixture's signals to a direct caller, even though the
// agents no longer generate new ones for confirmed non-World-Cup fixtures.
const SIGNAL_FEED_SELECT = `
  SELECT
    s.id, s.agent_id, s.fixture_id, s.outcome_key, s.odds_message_id, s.odds_ts,
    s.pct_before, s.pct_after, s.pct_change, s.detected_at, s.payload_json, s.payload_hash, s.idempotency_key,
    c.commit_tx_sig, c.commit_slot, c.committed_at,
    r.reveal_tx_sig, r.revealed_at, r.hash_verified,
    g.final_outcome, g.correct, g.scores_seq_used, g.validation_proof_checked, g.odds_proof_checked, g.graded_at
  FROM signals s
  JOIN tracked_fixtures tf ON tf.fixture_id = s.fixture_id
  LEFT JOIN commits c ON c.signal_id = s.id
  LEFT JOIN reveals r ON r.signal_id = s.id
  LEFT JOIN grades g ON g.signal_id = s.id
`;

export interface SignalFeedFilters {
  fixtureId?: number;
  agentId?: string;
  limit?: number;
}

/** The "feed cronológico de eventos" from the architecture doc's dashboard spec (section 13). */
export async function listSignalFeed(pool: Pool, filters: SignalFeedFilters = {}): Promise<SignalWithLifecycle[]> {
  const conditions: string[] = [`tf.competition ILIKE 'World Cup'`];
  const params: unknown[] = [];

  if (filters.fixtureId !== undefined) {
    params.push(filters.fixtureId);
    conditions.push(`s.fixture_id = $${params.length}`);
  }
  if (filters.agentId !== undefined) {
    params.push(filters.agentId);
    conditions.push(`s.agent_id = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  params.push(filters.limit ?? 200);
  const query = `${SIGNAL_FEED_SELECT} ${where} ORDER BY s.detected_at DESC LIMIT $${params.length}`;

  const { rows } = await pool.query<SignalFeedDbRow>(query, params);
  return rows.map(mapSignalFeedRow);
}

/** Signals whose lifecycle changed (created, committed, revealed, or graded) since `sinceIso` — powers the WebSocket push. */
export async function listSignalFeedUpdatedSince(pool: Pool, sinceIso: string): Promise<SignalWithLifecycle[]> {
  const query = `${SIGNAL_FEED_SELECT}
    WHERE (s.detected_at > $1
       OR c.committed_at > $1
       OR r.revealed_at > $1
       OR g.graded_at > $1)
      AND tf.competition ILIKE 'World Cup'
    ORDER BY s.detected_at ASC
    LIMIT 500`;
  const { rows } = await pool.query<SignalFeedDbRow>(query, [sinceIso]);
  return rows.map(mapSignalFeedRow);
}
