import { config as loadDotenv } from "dotenv";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import { createConnection } from "./solana.js";
import { createPool } from "./db.js";
import { registerVerifyRoute } from "./routes/verify.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerFixtureRoutes } from "./routes/fixtures.js";
import { registerSignalRoutes } from "./routes/signals.js";
import { registerWebSocketRoute } from "./routes/ws.js";

loadDotenv();

/**
 * REST + WebSocket API for the dashboard (architecture doc section 9/10).
 * Read-only by design (architecture doc section 11, "Production Readiness"
 * table) — nothing here can act on behalf of an agent, only observe what
 * they've already done.
 */
async function main() {
  const app = Fastify({ logger: true });
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyWebsocket);

  const connection = createConnection();
  const pool = createPool();

  app.get("/health", async () => ({ status: "ok" }));
  registerVerifyRoute(app, connection);
  registerAgentRoutes(app, pool, connection);
  registerFixtureRoutes(app, pool);
  registerSignalRoutes(app, pool);
  registerWebSocketRoute(app, pool);

  app.addHook("onClose", async () => {
    await pool.end();
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
