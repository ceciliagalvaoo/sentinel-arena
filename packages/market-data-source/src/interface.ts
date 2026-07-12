import type { OddsEvent, ScoreEvent } from "@sentinel/shared-types";

/**
 * The one abstraction the whole agent runtime is built on (architecture doc
 * section 2.2): agents never talk to TxLINE directly, only to this
 * interface. `LiveTxLineSource` and `ReplayDataSource` are the only two
 * implementations, and agent-facing code must behave identically against
 * both — if a feature only works against one of them, the abstraction is
 * leaking and needs to be fixed before shipping.
 */
export interface MarketDataSource {
  onOdds(handler: (event: OddsEvent) => void): void;
  onScore(handler: (event: ScoreEvent) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Small shared base so Live/Replay implementations don't each reinvent
 * handler registration/dispatch — they only need to implement start()/stop()
 * and call `emitOdds`/`emitScore` when a normalized event is ready.
 */
export abstract class BaseMarketDataSource implements MarketDataSource {
  private oddsHandlers: Array<(event: OddsEvent) => void> = [];
  private scoreHandlers: Array<(event: ScoreEvent) => void> = [];

  onOdds(handler: (event: OddsEvent) => void): void {
    this.oddsHandlers.push(handler);
  }

  onScore(handler: (event: ScoreEvent) => void): void {
    this.scoreHandlers.push(handler);
  }

  protected emitOdds(event: OddsEvent): void {
    for (const handler of this.oddsHandlers) handler(event);
  }

  protected emitScore(event: ScoreEvent): void {
    for (const handler of this.scoreHandlers) handler(event);
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
