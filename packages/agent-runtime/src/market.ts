import type { OddsEvent } from "@sentinel/shared-types";

/**
 * MVP scope: only the StablePrice consensus feed on the primary soccer 1X2
 * (match-winner) market is monitored — matches the "Sharp Movement
 * Detector" idea from the hackathon brief (architecture doc section 0.2),
 * which explicitly targets StablePrice. A single fixture's full odds feed
 * has tens of thousands of ticks across many bookmakers/markets (see README
 * feedback log, 2026-07-12); tracking all of them would be noise, not
 * signal, for a v1.
 */
export interface MarketFilter {
  superOddsType: string;
  bookmaker: string;
}

export const DEFAULT_MARKET_FILTER: MarketFilter = {
  superOddsType: "1X2_PARTICIPANT_RESULT",
  bookmaker: "TXLineStablePriceDemargined",
};

export function matchesMarketFilter(event: OddsEvent, filter: MarketFilter): boolean {
  return event.superOddsType === filter.superOddsType && event.bookmaker === filter.bookmaker;
}

const PRICE_NAME_TO_OUTCOME_KEY: Record<string, string> = {
  part1: "participant1_win",
  draw: "draw",
  part2: "participant2_win",
};

export function mapPriceNameToOutcomeKey(priceName: string): string | null {
  return PRICE_NAME_TO_OUTCOME_KEY[priceName] ?? null;
}

/**
 * v1 scope is the World Cup specifically (hackathon brief). Once the
 * tournament is over the live TxLINE feed also carries other competitions
 * (e.g. a Vietnam x Myanmar friendly), and the agent otherwise registers
 * odds for any soccer fixture it sees — without this filter a
 * non-tournament match would both burn real SOL on commit/reveal
 * transactions and grow tracked_fixtures indefinitely. Case-insensitive to
 * match the `ILIKE 'World Cup'` filter already used server-side
 * (apps/backend-api/src/db.ts's accuracy aggregate).
 */
export const TRACKED_COMPETITION = "World Cup";

export function isTrackedCompetition(competition: string): boolean {
  return competition.trim().toLowerCase() === TRACKED_COMPETITION.toLowerCase();
}

export type FinalOutcome = "participant1_win" | "participant2_win" | "draw";

interface SoccerScoreTree {
  Participant1?: { Total?: { Goals?: number } };
  Participant2?: { Total?: { Goals?: number } };
}

/**
 * Determines the final match outcome from a `game_finalised` score record
 * (StatusId=100/period=100 — covers normal time, extra time, penalties and
 * abandoned matches through the same field per architecture doc section
 * 5.17). Soccer-only for now: reads `Score.Participant{1,2}.Total.Goals`.
 */
export function determineOutcome(finalScoreRecordRaw: Record<string, unknown>): FinalOutcome {
  const score = finalScoreRecordRaw.Score as SoccerScoreTree | undefined;
  const goals1 = score?.Participant1?.Total?.Goals ?? 0;
  const goals2 = score?.Participant2?.Total?.Goals ?? 0;
  if (goals1 > goals2) return "participant1_win";
  if (goals2 > goals1) return "participant2_win";
  return "draw";
}
