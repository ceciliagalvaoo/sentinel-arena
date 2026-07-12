import {
  streamOdds,
  streamScores,
  type NetworkConfig,
  type StreamCredentials,
  type StreamHandle,
} from "@sentinel/txline-client";
import { BaseMarketDataSource } from "./interface.js";
import { ReconnectingSseClient } from "./reconnect.js";

/**
 * SSE-backed live implementation of MarketDataSource. Connecting
 * successfully only means credentials were accepted — it does not guarantee
 * the covered fixtures are producing data at that exact moment (architecture
 * doc section 5.11); silence punctuated by heartbeats is a normal state.
 *
 * Every drop — even ones the underlying `eventsource` library might retry
 * internally — is treated as fatal for that attempt: we close it ourselves
 * and let `ReconnectingSseClient` own all retry timing (architecture doc
 * section 6.2's "connect() deve rejeitar/lançar quando a conexão cair").
 * Two independent reconnect loops run (odds, scores) since either stream can
 * drop without the other.
 */
export class LiveTxLineSource extends BaseMarketDataSource {
  private oddsHandle: StreamHandle | null = null;
  private scoresHandle: StreamHandle | null = null;
  private readonly oddsReconnect = new ReconnectingSseClient();
  private readonly scoresReconnect = new ReconnectingSseClient();

  constructor(
    private readonly config: NetworkConfig,
    private readonly credentials: StreamCredentials,
    private readonly renewJwt: () => Promise<string>,
    private readonly onError?: (err: unknown) => void,
  ) {
    super();
  }

  async start(): Promise<void> {
    void this.oddsReconnect.connectWithBackoff(() => this.connectOddsOnce());
    void this.scoresReconnect.connectWithBackoff(() => this.connectScoresOnce());
  }

  async stop(): Promise<void> {
    this.oddsReconnect.stop();
    this.scoresReconnect.stop();
    this.oddsHandle?.close();
    this.scoresHandle?.close();
    this.oddsHandle = null;
    this.scoresHandle = null;
  }

  /** Resolves only if `stop()` tears it down cleanly; any stream error rejects, triggering backoff. */
  private connectOddsOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const handle = streamOdds(
        this.config.apiBaseUrl,
        this.credentials,
        this.renewJwt,
        (event) => this.emitOdds(event),
        (err) => {
          if (settled) return;
          settled = true;
          this.onError?.(err);
          handle.close();
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
      this.oddsHandle = handle;
    });
  }

  private connectScoresOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const handle = streamScores(
        this.config.apiBaseUrl,
        this.credentials,
        this.renewJwt,
        (event) => this.emitScore(event),
        (err) => {
          if (settled) return;
          settled = true;
          this.onError?.(err);
          handle.close();
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
      this.scoresHandle = handle;
    });
  }
}
