import type { AgentCardData, AgentRow, SignalWithLifecycle, TrackedFixtureRow } from "./types";

/**
 * Shaped after real data (fixture 18209181, France x Morocco) — not copied
 * verbatim, but the field values are realistic so the UI reads correctly
 * once wired to the live API. Swap this module for real fetch/WS calls
 * without touching component code — that's the whole point of lib/types.ts
 * matching the backend contract exactly.
 */

export const mockFixture: TrackedFixtureRow = {
  fixtureId: 18209181,
  competition: "World Cup",
  participant1: "France",
  participant2: "Morocco",
  startTime: "2026-07-09T20:00:00.000Z",
  status: "finished",
  capturedLive: false,
};

const aggressiveAgent: AgentRow = {
  id: "agent-aggressive",
  strategyName: "aggressive",
  sensitivityMultiplier: 1.5,
  windowSeconds: 60,
  warmupReadings: 30,
  walletPubkey: "78t5fVzwXPtfigre8pfMMJvNr1btzSJNgYC8YiA7EMw1",
  createdAt: "2026-07-12T05:43:00.218Z",
};

const conservativeAgent: AgentRow = {
  id: "agent-conservative",
  strategyName: "conservative",
  sensitivityMultiplier: 3.0,
  windowSeconds: 180,
  warmupReadings: 30,
  walletPubkey: "AQ2uD5FNWzD1bbdWcUpfDFZcteUNGvUP5myYzaLpfoMH",
  createdAt: "2026-07-12T05:43:00.218Z",
};

function buildSignal(
  agentId: "agent-aggressive" | "agent-conservative",
  index: number,
  outcomeKey: string,
  pctChange: number,
  stage: "committed" | "revealed-correct" | "revealed-incorrect",
): SignalWithLifecycle {
  const baseTs = Date.parse("2026-07-09T21:45:00.000Z") + index * 47_000;
  const detectedAt = new Date(baseTs).toISOString();
  const committedAt = new Date(baseTs + 1_100).toISOString();
  const revealedAt = new Date(baseTs + 8_200_000).toISOString();

  return {
    id: `${agentId}-mock-${index}`,
    agentId,
    fixtureId: mockFixture.fixtureId,
    outcomeKey,
    oddsMessageId: `1837051028:00003:0002${index.toString().padStart(2, "0")}-10021-stab`,
    oddsTs: baseTs,
    pctBefore: 45 + index,
    pctAfter: 45 + index + pctChange * 100,
    pctChange,
    detectedAt,
    payloadHash: `${agentId === "agent-aggressive" ? "1a2b3c" : "9f8e7d"}${index.toString().padStart(2, "0")}de8f562e4bdbb0d7af40573deb162bb4401f20fd34af1c1b2ed0a4fffa86`,
    commit: {
      commitTxSig: `${agentId === "agent-aggressive" ? "5a8btJRsTBjYeTvDWvXJkwdBdBT7Xs9Lk9CJxL97mdrQTbZKMTr1oJJmEjbDsMNZeqyiv8GDWb2vDkMEyUobVek" : "2LjkLd8cfPdA7TXRvdpYmumNsbaZD4xUWGVTB3xLScs6M3WGhz3Q8z8GxKCRadh8cC8kEUZSZAViXFV9gNNPwix"}${index}`,
      commitSlot: 475_600_000 + index * 37,
      committedAt,
    },
    reveal:
      stage === "committed"
        ? null
        : {
            revealTxSig: `${agentId === "agent-aggressive" ? "294QuTAh2hWAiqJBkWhmMCYerUiGWbj2GywfyovnTKZbfLZBhGXRFgeWKamBd5hnvW3vmwsgY2Ldc5MdqXFg3Bf" : "ri2gLcg5ByTqanECiZgbmVSaP5G4jds4eU8QFNoaQwSonnLPoMmJVtUtS22BH6CzRAtshCrYWahQdJopRzZMwUM"}${index}`,
            revealedAt,
            hashVerified: true,
          },
    grade:
      stage === "committed"
        ? null
        : {
            finalOutcome: stage === "revealed-correct" ? outcomeKey : outcomeKey === "participant1_win" ? "draw" : "participant1_win",
            correct: stage === "revealed-correct",
            scoresSeqUsed: 1114,
            validationProofChecked: true,
            oddsProofChecked: true,
            gradedAt: revealedAt,
          },
  };
}

const aggressiveSignals: SignalWithLifecycle[] = [
  buildSignal("agent-aggressive", 5, "participant1_win", 0.5066, "revealed-correct"),
  buildSignal("agent-aggressive", 4, "draw", -0.4424, "revealed-incorrect"),
  buildSignal("agent-aggressive", 3, "participant1_win", 0.4753, "revealed-correct"),
  buildSignal("agent-aggressive", 2, "draw", -0.437, "revealed-correct"),
  buildSignal("agent-aggressive", 1, "participant2_win", -0.0684, "revealed-incorrect"),
  buildSignal("agent-aggressive", 0, "participant1_win", 0.4744, "committed"),
];

const conservativeSignals: SignalWithLifecycle[] = [
  buildSignal("agent-conservative", 2, "participant1_win", 0.612, "revealed-correct"),
  buildSignal("agent-conservative", 1, "participant1_win", 0.588, "revealed-correct"),
  buildSignal("agent-conservative", 0, "draw", -0.51, "committed"),
];

export const mockAgentCards: Record<"agent-aggressive" | "agent-conservative", AgentCardData> = {
  "agent-aggressive": {
    agent: aggressiveAgent,
    accuracy: { agentId: "agent-aggressive", correctSignals: 55, totalGradedSignals: 143, accuracy: 55 / 143, allValidationChecked: false },
    wallet: { lamports: 2_487_320_000, sol: 2.48732, status: "active" },
    status: "active",
    recentSignals: aggressiveSignals,
  },
  "agent-conservative": {
    agent: conservativeAgent,
    accuracy: { agentId: "agent-conservative", correctSignals: 2, totalGradedSignals: 2, accuracy: 1, allValidationChecked: true },
    wallet: { lamports: 2_493_110_000, sol: 2.49311, status: "active" },
    status: "active",
    recentSignals: conservativeSignals,
  },
};
