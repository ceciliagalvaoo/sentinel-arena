import type { OddsEvent, ScoreEvent } from "@sentinel/shared-types";
import type { RawOddsPayload, RawScoreRecord } from "./wire-types.js";

export function toOddsEvent(raw: RawOddsPayload): OddsEvent {
  return {
    fixtureId: raw.FixtureId,
    messageId: raw.MessageId,
    ts: raw.Ts,
    bookmaker: raw.Bookmaker,
    bookmakerId: raw.BookmakerId,
    superOddsType: raw.SuperOddsType,
    gameState: raw.GameState ?? undefined,
    inRunning: raw.InRunning,
    marketPeriod: raw.MarketPeriod,
    priceNames: raw.PriceNames,
    prices: raw.Prices,
    pct: raw.Pct,
    raw,
  };
}

export function toScoreEvent(raw: RawScoreRecord): ScoreEvent {
  return {
    fixtureId: raw.FixtureId,
    action: raw.Action,
    ts: raw.Ts,
    seq: raw.Seq,
    gameState: typeof raw.GameState === "number" ? raw.GameState : undefined,
    stats: raw.Stats as Record<number, number> | undefined,
    raw,
  };
}
