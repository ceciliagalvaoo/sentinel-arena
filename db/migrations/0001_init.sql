-- Sentinel PRO Arena — initial schema (architecture doc section 3.1)
-- Applied via `npm run db:migrate` (scripts/migrate.ts)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- Configuração de cada agente
CREATE TABLE IF NOT EXISTS agents (
  id                     TEXT PRIMARY KEY,           -- 'agent-aggressive' | 'agent-conservative'
  strategy_name          TEXT NOT NULL,
  sensitivity_multiplier NUMERIC NOT NULL,           -- k: 1.5 (aggressive) ou 3.0 (conservative)
  window_seconds         INTEGER NOT NULL,           -- janela de cálculo da variação
  warmup_readings        INTEGER NOT NULL DEFAULT 30,-- nº de leituras antes de calibrar o limiar
  wallet_pubkey          TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixtures sendo monitoradas
CREATE TABLE IF NOT EXISTS tracked_fixtures (
  fixture_id      BIGINT PRIMARY KEY,
  competition     TEXT,
  participant1    TEXT,
  participant2    TEXT,
  start_time      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'finished'))
);

-- Limiar calibrado por agente x fixture (cada fixture calibra o próprio limiar)
CREATE TABLE IF NOT EXISTS calibrated_thresholds (
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  fixture_id        BIGINT NOT NULL REFERENCES tracked_fixtures(fixture_id),
  threshold_value   NUMERIC NOT NULL,
  calibrated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, fixture_id)
);

-- Cada sinal detectado, antes do commit
CREATE TABLE IF NOT EXISTS signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  fixture_id        BIGINT NOT NULL REFERENCES tracked_fixtures(fixture_id),
  outcome_key       TEXT NOT NULL,            -- ex.: 'participant1_win'
  odds_message_id   TEXT NOT NULL,            -- MessageId do OddsPayload usado
  odds_ts           BIGINT NOT NULL,          -- Ts do OddsPayload
  pct_before        NUMERIC NOT NULL,
  pct_after         NUMERIC NOT NULL,
  pct_change        NUMERIC NOT NULL,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_json      JSONB NOT NULL,           -- payload canônico completo (SignalPayload)
  payload_hash      TEXT NOT NULL,            -- sha256 hex do payload canônico
  idempotency_key   TEXT NOT NULL             -- ver computeIdempotencyKey — evita commit duplicado
);

-- Garante que o mesmo evento de mercado nunca gera dois sinais/commits pro mesmo agente
CREATE UNIQUE INDEX IF NOT EXISTS signals_idempotency_uq ON signals (agent_id, idempotency_key);
CREATE INDEX IF NOT EXISTS signals_fixture_idx ON signals (fixture_id);
CREATE INDEX IF NOT EXISTS signals_agent_idx ON signals (agent_id);

-- Commit publicado on-chain
CREATE TABLE IF NOT EXISTS commits (
  signal_id         UUID PRIMARY KEY REFERENCES signals(id),
  commit_tx_sig     TEXT NOT NULL,
  commit_slot       BIGINT,
  committed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reveal publicado on-chain, após o fim do jogo
CREATE TABLE IF NOT EXISTS reveals (
  signal_id         UUID PRIMARY KEY REFERENCES signals(id),
  reveal_tx_sig     TEXT NOT NULL,
  revealed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  hash_verified     BOOLEAN NOT NULL          -- recomputado e comparado ao commit
);

-- Resultado da auto-avaliação (grading)
CREATE TABLE IF NOT EXISTS grades (
  signal_id                UUID PRIMARY KEY REFERENCES signals(id),
  final_outcome             TEXT NOT NULL,            -- outcome que de fato ocorreu
  correct                   BOOLEAN NOT NULL,
  scores_seq_used           INTEGER NOT NULL,         -- seq do registro game_finalised usado
  validation_proof_checked  BOOLEAN NOT NULL DEFAULT false,
  graded_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eventos brutos gravados para o modo replay
CREATE TABLE IF NOT EXISTS recorded_events (
  id                BIGSERIAL PRIMARY KEY,
  fixture_id        BIGINT NOT NULL,
  event_type        TEXT NOT NULL CHECK (event_type IN ('odds', 'score')),
  raw_payload       JSONB NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL,
  sequence_index    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS recorded_events_fixture_seq_idx ON recorded_events (fixture_id, sequence_index);

-- Seed dos dois agentes (wallet_pubkey é preenchido pelo setup-subscription.ts
-- na primeira vez que cada wallet é gerada — placeholder até lá)
INSERT INTO agents (id, strategy_name, sensitivity_multiplier, window_seconds, warmup_readings, wallet_pubkey)
VALUES
  ('agent-aggressive', 'aggressive', 1.5, 60, 30, 'UNSET'),
  ('agent-conservative', 'conservative', 3.0, 180, 30, 'UNSET')
ON CONFLICT (id) DO NOTHING;
