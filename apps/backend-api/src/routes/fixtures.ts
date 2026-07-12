import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { listTrackedFixtures } from "../db.js";

/** Backs the dashboard's Ao Vivo/Replay fixture selector (architecture doc section 13). */
export function registerFixtureRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/fixtures", async () => listTrackedFixtures(pool));
}
