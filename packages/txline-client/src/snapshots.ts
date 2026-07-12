import type { AxiosInstance } from "axios";
import { parseSseBodyToJson } from "./sse-text.js";
import type { RawFixture, RawOddsPayload, RawScoreRecord } from "./wire-types.js";

export interface FixturesSnapshotParams {
  startEpochDay?: number;
  competitionId?: number;
}

/** GET /api/fixtures/snapshot — window is startEpochDay (default: today UTC) through +30 days. */
export async function fetchFixturesSnapshot(apiClient: AxiosInstance, params: FixturesSnapshotParams = {}): Promise<RawFixture[]> {
  const response = await apiClient.get<RawFixture[]>("/fixtures/snapshot", { params });
  return response.data;
}

/** GET /api/scores/snapshot/{fixtureId} */
export async function fetchScoresSnapshot(apiClient: AxiosInstance, fixtureId: number, asOf?: number): Promise<RawScoreRecord[]> {
  const response = await apiClient.get<RawScoreRecord[]>(`/scores/snapshot/${fixtureId}`, {
    params: asOf !== undefined ? { asOf } : undefined,
  });
  return response.data;
}

/**
 * GET /api/scores/historical/{fixtureId} — full update sequence for a
 * fixture that started between 2 weeks and 6h ago. NOTE: unlike every other
 * endpoint in this file, this one responds as SSE-framed text
 * (`Content-Type: text/event-stream`), not a plain JSON array — see
 * sse-text.ts for why.
 */
export async function fetchScoresHistorical(apiClient: AxiosInstance, fixtureId: number): Promise<RawScoreRecord[]> {
  const response = await apiClient.get<string>(`/scores/historical/${fixtureId}`, { responseType: "text" });
  return parseSseBodyToJson<RawScoreRecord>(response.data);
}

/** GET /api/scores/updates/{epochDay}/{hourOfDay}/{interval} — historical, plain JSON (unlike scores/historical). */
export async function fetchScoresUpdatesByInterval(
  apiClient: AxiosInstance,
  epochDay: number,
  hourOfDay: number,
  interval: number,
  fixtureId?: number,
): Promise<RawScoreRecord[]> {
  const response = await apiClient.get<RawScoreRecord[]>(`/scores/updates/${epochDay}/${hourOfDay}/${interval}`, {
    params: fixtureId !== undefined ? { fixtureId } : undefined,
  });
  return response.data;
}

/** GET /api/odds/snapshot/{fixtureId} — latest odds per market line, or as of a given timestamp. */
export async function fetchOddsSnapshot(apiClient: AxiosInstance, fixtureId: number, asOf?: number): Promise<RawOddsPayload[]> {
  const response = await apiClient.get<RawOddsPayload[]>(`/odds/snapshot/${fixtureId}`, {
    params: asOf !== undefined ? { asOf } : undefined,
  });
  return response.data;
}

/** GET /api/odds/updates/{epochDay}/{hourOfDay}/{interval} — historical odds ticks for a 5-minute bucket. */
export async function fetchOddsUpdatesByInterval(
  apiClient: AxiosInstance,
  epochDay: number,
  hourOfDay: number,
  interval: number,
  fixtureId?: number,
): Promise<RawOddsPayload[]> {
  const response = await apiClient.get<RawOddsPayload[]>(`/odds/updates/${epochDay}/${hourOfDay}/${interval}`, {
    params: fixtureId !== undefined ? { fixtureId } : undefined,
  });
  return response.data;
}
