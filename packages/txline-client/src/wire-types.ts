/**
 * Raw wire-format shapes as TxLINE actually returns them (PascalCase, per
 * the OpenAPI reference section 5.19 plus fields observed on live responses
 * that aren't in the documented schema table, e.g. GameState on Fixture).
 * These are intentionally loose (index signatures) rather than exhaustive —
 * see @sentinel/shared-types for the normalized camelCase shapes the rest
 * of the app consumes.
 */

export interface RawFixture {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
  GameState?: number;
  [key: string]: unknown;
}

export interface RawOddsPayload {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  GameState: number | null;
  InRunning: boolean;
  MarketParameters: unknown;
  MarketPeriod: string;
  PriceNames: string[];
  Prices: number[];
  Pct: string[];
  [key: string]: unknown;
}

export interface RawScoreRecord {
  FixtureId: number;
  Action: string;
  Ts: number;
  Seq: number;
  GameState?: string | number;
  StatusId?: number;
  Stats?: Record<string, number>;
  [key: string]: unknown;
}
