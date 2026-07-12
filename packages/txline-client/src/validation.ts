import { BN, type Program } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, type Connection, type PublicKey } from "@solana/web3.js";
import type { AxiosInstance } from "axios";
import { getDailyBatchRootsPda, getDailyScoresRootsPda } from "./pda.js";
import type { RawOddsPayload } from "./wire-types.js";

/**
 * Types below mirror the on-chain `validate_stat_v2` instruction exactly —
 * verified against idl/devnet/txoracle.json's `types` section (Anchor
 * snake_case IDL fields become camelCase in the JS/TS client), not just the
 * architecture doc's illustrative snippet. `program` is typed with the
 * generic anchor.Idl (see program.ts), so these shapes aren't enforced by
 * the compiler on the actual `.methods.validateStatV2()` call — getting
 * them right here is what makes that call succeed on-chain instead of
 * failing on account/argument deserialization.
 */
export interface AnchorProofNode {
  hash: number[];
  isRightSibling: boolean;
}

export interface AnchorScoresUpdateStats {
  updateCount: number;
  minTimestamp: BN;
  maxTimestamp: BN;
}

export interface AnchorScoresBatchSummary {
  fixtureId: BN;
  updateStats: AnchorScoresUpdateStats;
  eventsSubTreeRoot: number[];
}

export interface AnchorScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface AnchorStatLeaf {
  stat: AnchorScoreStat;
  statProof: AnchorProofNode[];
}

export interface AnchorStatValidationInput {
  ts: BN;
  fixtureSummary: AnchorScoresBatchSummary;
  fixtureProof: AnchorProofNode[];
  mainTreeProof: AnchorProofNode[];
  eventStatRoot: number[];
  stats: AnchorStatLeaf[];
}

export type AnchorComparison = { greaterThan: Record<string, never> } | { lessThan: Record<string, never> } | { equalTo: Record<string, never> };

export interface AnchorTraderPredicate {
  threshold: number;
  comparison: AnchorComparison;
}

export type AnchorBinaryOp = { add: Record<string, never> } | { subtract: Record<string, never> };

export type AnchorStatPredicate =
  | { single: { index: number; predicate: AnchorTraderPredicate } }
  | { binary: { indexA: number; indexB: number; op: AnchorBinaryOp; predicate: AnchorTraderPredicate } };

export interface AnchorGeometricTarget {
  statIndex: number;
  prediction: number;
}

export interface AnchorNDimensionalStrategy {
  geometricTargets: AnchorGeometricTarget[];
  distancePredicate: AnchorTraderPredicate | null;
  discretePredicates: AnchorStatPredicate[];
}

/** Raw wire shape of GET /api/scores/stat-validation?...&statKeys=... (architecture doc section 5.19). */
export interface RawProofNode {
  hash: string | number[];
  isRightSibling: boolean;
}

export interface RawScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface RawScoresUpdateStats {
  updateCount: number;
  minTimestamp: number;
  maxTimestamp: number;
}

export interface RawScoresBatchSummary {
  fixtureId: number;
  updateStats: RawScoresUpdateStats;
  eventStatsSubTreeRoot: string;
}

export interface RawStatValidationV2 {
  summary: RawScoresBatchSummary;
  subTreeProof: RawProofNode[];
  mainTreeProof: RawProofNode[];
  eventStatRoot: string;
  statsToProve: RawScoreStat[];
  statProofs: RawProofNode[][];
}

/** Decodes a proof hash (base64, 0x-hex, or a raw byte array) to exactly 32 bytes — required by the on-chain program. */
export function toBytes32(value: string | number[] | Uint8Array): number[] {
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : value instanceof Uint8Array
      ? value
      : value.startsWith("0x")
        ? Buffer.from(value.slice(2), "hex")
        : Buffer.from(value, "base64");
  if (bytes.length !== 32) throw new Error(`Expected 32 bytes, received ${bytes.length}`);
  return Array.from(bytes);
}

export function toProofNodes(nodes: RawProofNode[]): AnchorProofNode[] {
  return nodes.map((node) => ({ hash: toBytes32(node.hash), isRightSibling: node.isRightSibling }));
}

/** GET /api/scores/stat-validation?fixtureId=&seq=&statKeys=1,2,... (V2, multi-stat). */
export async function fetchStatValidationV2(
  apiClient: AxiosInstance,
  fixtureId: number,
  seq: number,
  statKeys: number[],
): Promise<RawStatValidationV2> {
  const response = await apiClient.get<RawStatValidationV2>("/scores/stat-validation", {
    params: { fixtureId, seq, statKeys: statKeys.join(",") },
  });
  return response.data;
}

/** Assembles the exact on-chain instruction payload from the raw API response — see checklist in architecture doc section 5.12. */
export function buildValidateStatV2Payload(validation: RawStatValidationV2): AnchorStatValidationInput {
  return {
    ts: new BN(validation.summary.updateStats.minTimestamp),
    fixtureSummary: {
      fixtureId: new BN(validation.summary.fixtureId),
      updateStats: {
        updateCount: validation.summary.updateStats.updateCount,
        minTimestamp: new BN(validation.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(validation.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: toBytes32(validation.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: toProofNodes(validation.subTreeProof),
    mainTreeProof: toProofNodes(validation.mainTreeProof),
    eventStatRoot: toBytes32(validation.eventStatRoot),
    stats: validation.statsToProve.map((stat, index) => ({
      stat,
      statProof: toProofNodes(validation.statProofs[index] ?? []),
    })),
  };
}

/**
 * Calls the on-chain `validateStatV2` as a read-only simulation (`.view()`,
 * no gas spent) — verifies both the Merkle proof (the stats really are
 * anchored in that day's Solana-committed root) and the supplied predicate
 * in one round trip. `program` must be built against the SAME network the
 * validation payload came from (architecture doc "golden rule").
 */
export async function validateStatV2Onchain(
  program: Program,
  connection: Connection,
  programId: PublicKey,
  validation: RawStatValidationV2,
  strategy: AnchorNDimensionalStrategy,
): Promise<boolean> {
  const payload = buildValidateStatV2Payload(validation);
  const [dailyScoresRootsPda] = getDailyScoresRootsPda(programId, validation.summary.updateStats.minTimestamp);
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  const result: unknown = await program.methods
    .validateStatV2!(payload, strategy)
    .accounts({ dailyScoresMerkleRoots: dailyScoresRootsPda })
    .preInstructions([computeBudgetIx])
    .view();

  return Boolean(result);
}

const TOTAL_GOALS_PARTICIPANT1_STAT_KEY = 1;
const TOTAL_GOALS_PARTICIPANT2_STAT_KEY = 2;

/**
 * Grading-engine convenience: cryptographically confirms, on-chain, that
 * the final goal counts used to determine `outcome` are the same ones
 * anchored in TxLINE's Merkle root for that day — not just what the REST
 * API happened to return. Soccer-only (statKeys 1/2, see architecture doc
 * section 5.17), matching market.ts's determineOutcome() scope. This is
 * what lets `grades.validation_proof_checked` mean something real instead
 * of just trusting the snapshot JSON.
 */
export async function validateFinalScoreOnchain(
  program: Program,
  connection: Connection,
  programId: PublicKey,
  apiClient: AxiosInstance,
  fixtureId: number,
  seq: number,
  outcome: "participant1_win" | "participant2_win" | "draw",
): Promise<boolean> {
  const validation = await fetchStatValidationV2(apiClient, fixtureId, seq, [
    TOTAL_GOALS_PARTICIPANT1_STAT_KEY,
    TOTAL_GOALS_PARTICIPANT2_STAT_KEY,
  ]);

  const comparison: AnchorComparison =
    outcome === "participant1_win" ? { greaterThan: {} } : outcome === "participant2_win" ? { lessThan: {} } : { equalTo: {} };

  const strategy: AnchorNDimensionalStrategy = {
    geometricTargets: [],
    distancePredicate: null,
    discretePredicates: [
      {
        binary: {
          indexA: 0, // statsToProve[0] = participant1 total goals (statKeys order preserved)
          indexB: 1, // statsToProve[1] = participant2 total goals
          op: { subtract: {} },
          predicate: { threshold: 0, comparison },
        },
      },
    ],
  };

  return validateStatV2Onchain(program, connection, programId, validation, strategy);
}

/**
 * Odds-proof types below mirror the on-chain `validate_odds` instruction
 * exactly — verified struct-by-struct against idl/devnet/txoracle.json's
 * `types` section (Odds, OddsBatchSummary, OddsUpdateStats), same discipline
 * as the score-validation types above.
 */
export interface AnchorOdds {
  fixtureId: BN;
  messageId: string;
  ts: BN;
  bookmaker: string;
  bookmakerId: number;
  superOddsType: string;
  gameState: string | null;
  inRunning: boolean;
  marketParameters: string | null;
  marketPeriod: string | null;
  priceNames: string[];
  prices: number[];
}

export interface AnchorOddsUpdateStats {
  updateCount: number;
  minTimestamp: BN;
  maxTimestamp: BN;
}

export interface AnchorOddsBatchSummary {
  fixtureId: BN;
  updateStats: AnchorOddsUpdateStats;
  oddsSubTreeRoot: number[];
}

export interface RawOddsUpdateStats {
  updateCount: number;
  minTimestamp: number;
  maxTimestamp: number;
}

export interface RawOddsBatchSummary {
  fixtureId: number;
  updateStats: RawOddsUpdateStats;
  oddsSubTreeRoot: string | number[];
}

export interface RawOddsValidation {
  odds: RawOddsPayload;
  summary: RawOddsBatchSummary;
  subTreeProof: RawProofNode[];
  mainTreeProof: RawProofNode[];
}

/** GET /api/odds/validation?messageId=&ts= — Merkle proof for one odds tick (architecture doc section 4.1 step 5, marked optional there). */
export async function fetchOddsValidation(apiClient: AxiosInstance, messageId: string, ts: number): Promise<RawOddsValidation> {
  const response = await apiClient.get<RawOddsValidation>("/odds/validation", { params: { messageId, ts } });
  return response.data;
}

/** The on-chain `Odds.game_state`/`market_parameters` fields are `option<string>`, but the REST payload can hand back a number (or, for MarketParameters, anything JSON-able) — stringify non-null values so borsh encodes the type the program actually expects. */
function toOptionString(value: unknown): string | null {
  return value === null || value === undefined ? null : typeof value === "string" ? value : JSON.stringify(value);
}

export function buildValidateOddsPayload(validation: RawOddsValidation): {
  ts: BN;
  oddsSnapshot: AnchorOdds;
  summary: AnchorOddsBatchSummary;
  subTreeProof: AnchorProofNode[];
  mainTreeProof: AnchorProofNode[];
} {
  return {
    // Unlike validateStatV2 (whose `ts` arg is the batch's minTimestamp),
    // validateOdds requires `ts` to equal odds_snapshot.ts exactly — this is
    // proving one specific tick, not a batch range. Confirmed against real
    // devnet: the batch minTimestamp fails with AnchorError TimestampMismatch.
    ts: new BN(validation.odds.Ts),
    oddsSnapshot: {
      fixtureId: new BN(validation.odds.FixtureId),
      messageId: validation.odds.MessageId,
      ts: new BN(validation.odds.Ts),
      bookmaker: validation.odds.Bookmaker,
      bookmakerId: validation.odds.BookmakerId,
      superOddsType: validation.odds.SuperOddsType,
      gameState: toOptionString(validation.odds.GameState),
      inRunning: validation.odds.InRunning,
      marketParameters: toOptionString(validation.odds.MarketParameters),
      marketPeriod: validation.odds.MarketPeriod,
      priceNames: validation.odds.PriceNames,
      prices: validation.odds.Prices,
    },
    summary: {
      fixtureId: new BN(validation.summary.fixtureId),
      updateStats: {
        updateCount: validation.summary.updateStats.updateCount,
        minTimestamp: new BN(validation.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(validation.summary.updateStats.maxTimestamp),
      },
      oddsSubTreeRoot: toBytes32(validation.summary.oddsSubTreeRoot),
    },
    subTreeProof: toProofNodes(validation.subTreeProof),
    mainTreeProof: toProofNodes(validation.mainTreeProof),
  };
}

/**
 * Calls the on-chain `validateOdds` as a read-only simulation (`.view()`) —
 * confirms the exact odds tick (prices, market, timestamp) that motivated a
 * signal is anchored in that day's Solana-committed Merkle root, not just
 * what the REST snapshot happened to return. Same PDA family as scores
 * (`daily_batch_roots`, see getDailyBatchRootsPda) but a separate root.
 */
export async function validateOddsOnchain(program: Program, connection: Connection, programId: PublicKey, validation: RawOddsValidation): Promise<boolean> {
  const payload = buildValidateOddsPayload(validation);
  const [dailyOddsRootsPda] = getDailyBatchRootsPda(programId, validation.odds.Ts);
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  const result: unknown = await program.methods
    .validateOdds!(payload.ts, payload.oddsSnapshot, payload.summary, payload.subTreeProof, payload.mainTreeProof)
    .accounts({ dailyOddsMerkleRoots: dailyOddsRootsPda })
    .preInstructions([computeBudgetIx])
    .view();

  return Boolean(result);
}

/** Grading-engine convenience: fetches the proof for one signal's odds tick and confirms it on-chain in one call. */
export async function validateSignalOddsOnchain(
  program: Program,
  connection: Connection,
  programId: PublicKey,
  apiClient: AxiosInstance,
  oddsMessageId: string,
  oddsTs: number,
): Promise<boolean> {
  const validation = await fetchOddsValidation(apiClient, oddsMessageId, oddsTs);
  return validateOddsOnchain(program, connection, programId, validation);
}
