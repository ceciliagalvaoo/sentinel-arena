/**
 * Backfills one or more completed World Cup fixtures' full Scores + Odds
 * history into `recorded_events`, so replay mode has real data to play back
 * (architecture doc section 8). Uses REST only — see
 * packages/recorder-service/src/backfill.ts for why this doesn't need a live
 * SSE session.
 *
 * Usage:
 *   DATABASE_URL=... tsx scripts/seed-replay-data.ts <fixtureId> [fixtureId ...]
 *
 * Reuses any agent's activated session (secrets/<agentId>-session.json) —
 * data endpoints aren't agent-specific, so agent-aggressive's token works
 * fine for backfilling data agent-conservative will also replay.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { createApiClient, getNetworkConfig, resolveNetworkFromEnv } from "@sentinel/txline-client";
import { backfillFixture } from "@sentinel/recorder-service";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

interface Session {
  network: "mainnet" | "devnet";
  jwt: string;
  apiToken: string;
}

function loadAnySession(): Session {
  for (const agentId of ["agent-aggressive", "agent-conservative"]) {
    const path = join(REPO_ROOT, "secrets", `${agentId}-session.json`);
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8")) as Session;
    }
  }
  throw new Error("No agent session found in secrets/ — run scripts/setup-subscription.ts for at least one agent first");
}

async function main() {
  const fixtureIds = process.argv.slice(2).map(Number);
  if (fixtureIds.length === 0 || fixtureIds.some((id) => !Number.isInteger(id))) {
    throw new Error("Usage: tsx scripts/seed-replay-data.ts <fixtureId> [fixtureId ...]");
  }

  const session = loadAnySession();
  const network = process.env.NETWORK ? resolveNetworkFromEnv() : session.network;
  const config = getNetworkConfig(network);
  const apiClient = createApiClient(config, session.jwt, session.apiToken);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    for (const fixtureId of fixtureIds) {
      console.log(`[backfill] fixture ${fixtureId}...`);
      const result = await backfillFixture({ apiClient, db, fixtureId });
      console.log(
        `[backfill] fixture ${fixtureId} done: ${result.scoreEventCount} score events, ${result.oddsEventCount} odds events, ${result.totalInserted} total rows` +
          (result.fixture ? ` — ${result.fixture.Participant1} x ${result.fixture.Participant2} (${result.fixture.Competition})` : " — fixture metadata not found"),
      );
    }
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
