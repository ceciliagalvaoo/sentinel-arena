/**
 * Normalized projections of TxLINE payloads (OddsPayload / Scores, see
 * TxLINE API reference section 5.19). Only the fields the agent runtime and
 * dashboard actually consume are typed strictly; sport-specific detail that
 * varies by feed (soccer/basketball/us-football) stays in `raw`.
 */

export interface OddsEvent {
  fixtureId: number;
  messageId: string;
  ts: number;
  bookmaker?: string;
  bookmakerId?: number;
  superOddsType?: string;
  gameState?: number;
  inRunning?: boolean;
  marketPeriod?: string;
  /** Parallel arrays, index-aligned: priceNames[i] <-> prices[i] <-> pct[i] */
  priceNames: string[];
  prices: number[];
  /** Each entry matches ^(NA|\d+\.\d{3})$ per the OddsPayload schema */
  pct: string[];
  raw: Record<string, unknown>;
}

export type ScoreAction = "game_finalised" | (string & {});

export interface ScoreEvent {
  fixtureId: number;
  action: ScoreAction;
  ts: number;
  seq: number;
  confirmed?: boolean;
  gameState?: number;
  /** Generic stat-key -> value map (Map_ScoreStatKey), see section 5.17/5.19 */
  stats?: Record<number, number>;
  raw: Record<string, unknown>;
}

export function isGameFinalised(event: ScoreEvent): boolean {
  return event.action === "game_finalised";
}

export function extractOutcomePct(event: OddsEvent, priceName: string): number | null {
  const index = event.priceNames.indexOf(priceName);
  if (index === -1) return null;
  const pctString = event.pct[index];
  if (pctString === undefined || pctString === "NA") return null;
  const value = Number(pctString);
  return Number.isFinite(value) ? value : null;
}
