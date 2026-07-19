import { EventSource, type FetchLikeResponse, type ReaderLike } from "eventsource";
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

const STREAM_IDLE_TIMEOUT_MS = 90_000;
const CONNECT_TIMEOUT_MS = 15_000;

/**
 * `withIdleTimeout` only guards the body *after* `fetch()` has already
 * resolved with a response — the `fetch()` call establishing that
 * connection in the first place had no timeout of its own. That gap let
 * `agent-conservative` wedge again on 2026-07-19: its odds stream died at
 * the previous fixture's `game_finalised`, `ReconnectingSseClient` correctly
 * kicked off a retry, and that retry's own `fetch()` stalled with no error
 * and no reconnect log for the next ~17h, identical symptom to the
 * 2026-07-15 incident but one call earlier in the chain than that fix
 * covers. Aborting the connect attempt itself after `CONNECT_TIMEOUT_MS`
 * guarantees a stuck reconnect surfaces as a rejected promise, which
 * `ReconnectingSseClient`'s backoff loop already knows how to retry.
 */
function fetchWithConnectTimeout(input: FetchInput, init: FetchInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`connect attempt timed out after ${timeoutMs}ms with no response`)),
    timeoutMs,
  );
  const outerSignal = init?.signal;
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort(outerSignal.reason);
    else outerSignal.addEventListener("abort", () => controller.abort(outerSignal.reason), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * The `eventsource` package's internal read loop is a bare
 * `await reader.read()` in a while-loop — if the underlying connection
 * stalls silently (socket never errors, never sends a byte again, no FIN/RST),
 * that promise never settles and nothing ever notices the stream is dead.
 * That silently froze this exact stream in production on 2026-07-15 for
 * ~3.5h with zero errors logged. Wrapping the reader so every `read()` races
 * an idle timeout guarantees a stall surfaces as a thrown (non-abort) error,
 * which `eventsource` routes through its normal reconnect path — same as
 * any other drop — rather than hanging forever.
 */
function withIdleTimeout(response: Response, idleMs: number): FetchLikeResponse {
  if (!response.body) return response;
  const realReader = response.body.getReader();
  const wrappedReader: ReaderLike = {
    async read() {
      let timer: ReturnType<typeof setTimeout>;
      const idleError = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void realReader.cancel().catch(() => {});
          reject(new Error(`SSE stream idle for ${idleMs}ms with no data — treating as dropped`));
        }, idleMs);
      });
      try {
        return await Promise.race([realReader.read(), idleError]);
      } finally {
        clearTimeout(timer!);
      }
    },
    cancel: () => realReader.cancel(),
  };
  return {
    body: { getReader: () => wrappedReader },
    url: response.url,
    status: response.status,
    redirected: response.redirected,
    headers: { get: (name: string) => response.headers.get(name) },
  };
}

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
        fetchWithConnectTimeout(
          input,
          {
            ...init,
            headers: {
              ...init?.headers,
              Authorization: `Bearer ${jwt}`,
              "X-Api-Token": credentials.apiToken,
            },
          },
          CONNECT_TIMEOUT_MS,
        );

      let response = await attempt(currentJwt);
      if (response.status === 401 || response.status === 403) {
        currentJwt = await renewJwt();
        response = await attempt(currentJwt);
      }
      return withIdleTimeout(response, STREAM_IDLE_TIMEOUT_MS);
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
