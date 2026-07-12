import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { listSignalFeed } from "../db.js";

interface SignalsQuery {
  fixtureId?: string;
  agentId?: string;
  limit?: string;
}

/** The "feed cronológico de eventos" the dashboard renders (architecture doc section 13). */
export function registerSignalRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Querystring: SignalsQuery }>("/api/signals", async (request) => {
    const { fixtureId, agentId, limit } = request.query;
    return listSignalFeed(pool, {
      fixtureId: fixtureId !== undefined ? Number(fixtureId) : undefined,
      agentId,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  });
}
