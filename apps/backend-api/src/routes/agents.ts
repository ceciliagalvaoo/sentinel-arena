import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { MIN_LAMPORTS_WARNING, type WalletBalanceInfo } from "@sentinel/shared-types";
import { getAgent, getAgentAccuracy, listAgents } from "../db.js";

export function registerAgentRoutes(app: FastifyInstance, pool: Pool, connection: Connection): void {
  app.get("/api/agents", async () => listAgents(pool));

  app.get<{ Params: { agentId: string } }>("/api/agents/:agentId/accuracy", async (request) => {
    return getAgentAccuracy(pool, request.params.agentId);
  });

  app.get<{ Params: { agentId: string } }>("/api/agents/:agentId/balance", async (request, reply) => {
    const agent = await getAgent(pool, request.params.agentId);
    if (!agent) return reply.status(404).send({ error: `Unknown agent: ${request.params.agentId}` });

    // Single getBalance call, reused for both the SOL figure and the
    // paused/active status — see WalletBalanceInfo's docstring for why this
    // used to be two separate RPC round trips against a slow public devnet
    // endpoint, which was intermittently timing out the whole dashboard load.
    const lamports = await connection.getBalance(new PublicKey(agent.walletPubkey));
    const balance: WalletBalanceInfo = {
      lamports,
      sol: lamports / 1_000_000_000,
      status: lamports < MIN_LAMPORTS_WARNING ? "paused" : "active",
    };
    return balance;
  });
}
