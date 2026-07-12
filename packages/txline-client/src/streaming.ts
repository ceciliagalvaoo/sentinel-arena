import { EventSource } from "eventsource";
import type { OddsEvent, ScoreEvent } from "@sentinel/shared-types";
import { toOddsEvent, toScoreEvent } from "./mappers.js";
import type { RawOddsPayload, RawScoreRecord } from "./wire-types.js";

export interface StreamCredentials {
  jwt: string;
  apiToken: string;
}

export interface StreamHandle {
  close(): void;
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/**
 * A stream connecting successfully only means credentials were accepted —
 * it does NOT guarantee the covered fixture is producing data at that exact
 * moment (architecture doc section 5.11). Silence punctuated only by
 * heartbeats is a normal state, not an error; check the Schedule if that's
 * unexpected.
 */
function openStream<TRaw, TNormalized>(
  url: string,
  credentials: StreamCredentials,
  renewJwt: () => Promise<string>,
  map: (raw: TRaw) => TNormalized,
  onEvent: (event: TNormalized) => void,
  onError?: (err: unknown) => void,
): StreamHandle {
  let currentJwt = credentials.jwt;

  const eventSource = new EventSource(url, {
    fetch: async (input: FetchInput, init?: FetchInit) => {
      const attempt = (jwt: string) =>
        fetch(input, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: `Bearer ${jwt}`,
            "X-Api-Token": credentials.apiToken,
          },
        });

      let response = await attempt(currentJwt);
      if (response.status === 401 || response.status === 403) {
        currentJwt = await renewJwt();
        response = await attempt(currentJwt);
      }
      return response;
    },
  } as ConstructorParameters<typeof EventSource>[1]);

  eventSource.onmessage = (event: MessageEvent<string>) => {
    try {
      const raw = JSON.parse(event.data) as TRaw;
      onEvent(map(raw));
    } catch (err) {
      onError?.(err);
    }
  };
  eventSource.onerror = (err: unknown) => onError?.(err);

  return { close: () => eventSource.close() };
}

/** GET /api/odds/stream — real-time StablePrice odds updates for permitted fixtures. */
export function streamOdds(
  apiBaseUrl: string,
  credentials: StreamCredentials,
  renewJwt: () => Promise<string>,
  onEvent: (event: OddsEvent) => void,
  onError?: (err: unknown) => void,
): StreamHandle {
  return openStream<RawOddsPayload, OddsEvent>(`${apiBaseUrl}/odds/stream`, credentials, renewJwt, toOddsEvent, onEvent, onError);
}

/** GET /api/scores/stream — real-time score/action updates for permitted fixtures. */
export function streamScores(
  apiBaseUrl: string,
  credentials: StreamCredentials,
  renewJwt: () => Promise<string>,
  onEvent: (event: ScoreEvent) => void,
  onError?: (err: unknown) => void,
): StreamHandle {
  return openStream<RawScoreRecord, ScoreEvent>(`${apiBaseUrl}/scores/stream`, credentials, renewJwt, toScoreEvent, onEvent, onError);
}
