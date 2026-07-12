import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { WebSocket } from "ws";
import { listSignalFeedUpdatedSince } from "../db.js";

const POLL_INTERVAL_MS = 2000;

/**
 * Pushes signal lifecycle changes (detected/committed/revealed/graded) to
 * every connected dashboard client. Backed by polling, not Postgres
 * LISTEN/NOTIFY — simpler to reason about for a hackathon timeline, and the
 * 2s latency is invisible next to Solana confirmation times anyway. Runs
 * ONE shared poll loop regardless of client count, not one per connection.
 */
export function registerWebSocketRoute(app: FastifyInstance, pool: Pool): void {
  const clients = new Set<WebSocket>();
  let lastPollIso = new Date().toISOString();

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });

  const timer = setInterval(() => {
    void (async () => {
      const now = new Date().toISOString();
      const since = lastPollIso;
      lastPollIso = now;

      if (clients.size === 0) return;

      try {
        const updated = await listSignalFeedUpdatedSince(pool, since);
        if (updated.length === 0) return;

        const message = JSON.stringify({ type: "signals_updated", signals: updated });
        for (const client of clients) {
          if (client.readyState === client.OPEN) client.send(message);
        }
      } catch (err) {
        app.log.error(err);
      }
    })();
  }, POLL_INTERVAL_MS);

  app.addHook("onClose", (_instance, done) => {
    clearInterval(timer);
    done();
  });
}
