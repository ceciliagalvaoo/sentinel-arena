import type { FastifyInstance } from "fastify";
import type { Connection } from "@solana/web3.js";
import { MalformedMemoError, verifySignalProof } from "@sentinel/commit-reveal";

interface VerifyQuery {
  commitTxSig?: string;
  revealTxSig?: string;
}

/**
 * GET /api/verify?commitTxSig=...&revealTxSig=...
 *
 * The public, standalone commit-reveal verification tool (architecture doc
 * section 4.3). Works for ANY pair of tx signatures using the Sentinel memo
 * format, not just ones produced by our own two agents — never assume the
 * caller is one of our agents' wallets.
 */
export function registerVerifyRoute(app: FastifyInstance, connection: Connection): void {
  app.get<{ Querystring: VerifyQuery }>("/api/verify", async (request, reply) => {
    const { commitTxSig, revealTxSig } = request.query;

    if (!commitTxSig || !revealTxSig) {
      return reply.status(400).send({
        error: "Both commitTxSig and revealTxSig query params are required",
      });
    }

    try {
      const result = await verifySignalProof(connection, commitTxSig, revealTxSig);
      return reply.send(result);
    } catch (err) {
      if (err instanceof MalformedMemoError) {
        return reply.status(400).send({ error: err.message });
      }
      request.log.error(err);
      return reply.status(502).send({ error: "Failed to verify proof — check tx signatures and network" });
    }
  });
}
