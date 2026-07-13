/**
 * One-time operator setup per agent wallet (architecture doc section 5.1):
 *   1. auth.start()               -> POST /auth/guest/start        -> jwt
 *   2. subscribe(serviceLevel=1)  -> on-chain (Anchor)              -> txSig
 *   3. token.activate(txSig, [])  -> POST /api/token/activate       -> apiToken
 *   4. persist jwt + apiToken + txSig (secrets/<agentId>-session.json,
 *      gitignored) and the wallet pubkey into the `agents` table.
 *
 * Usage:
 *   DATABASE_URL=... tsx scripts/setup-subscription.ts <agentId>
 *
 * Reads the rest of its config (NETWORK, WALLET_KEYPAIR_PATH, ...) from
 * apps/<agentId>/.env — the same file the agent process itself uses, so
 * there's exactly one source of truth per agent.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Keypair } from "@solana/web3.js";
import { Client } from "pg";
import { resolveDatabaseSsl } from "@sentinel/shared-types";
import {
  activateApiToken,
  createProgram,
  getNetworkConfig,
  resolveNetworkFromEnv,
  startGuestAuth,
  subscribeOnChain,
} from "@sentinel/txline-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const FREE_TIER_SERVICE_LEVEL_ID = 1; // World Cup + international friendlies, see architecture doc section 5.5
const SUBSCRIPTION_WEEKS = 4;

function loadAgentEnv(agentId: string): NodeJS.ProcessEnv {
  const envPath = join(REPO_ROOT, "apps", agentId, ".env");
  if (!existsSync(envPath)) {
    throw new Error(`No .env for agent "${agentId}" at ${envPath} — copy apps/${agentId}/.env.example first`);
  }
  const parsed = dotenv.parse(readFileSync(envPath, "utf8"));
  return { ...process.env, ...parsed };
}

function loadWallet(keypairPath: string): Keypair {
  const resolvedPath = keypairPath.startsWith(".") ? join(REPO_ROOT, keypairPath) : keypairPath;
  const secretKey = Uint8Array.from(JSON.parse(readFileSync(resolvedPath, "utf8")));
  return Keypair.fromSecretKey(secretKey);
}

async function main() {
  const agentId = process.argv[2];
  if (!agentId) {
    throw new Error("Usage: tsx scripts/setup-subscription.ts <agentId>");
  }

  const env = loadAgentEnv(agentId);
  const network = resolveNetworkFromEnv(env);
  const config = getNetworkConfig(network);
  const payer = loadWallet(env.WALLET_KEYPAIR_PATH!);

  console.log(`[${agentId}] network=${network} wallet=${payer.publicKey.toBase58()}`);

  console.log(`[${agentId}] requesting guest JWT...`);
  const jwt = await startGuestAuth(config.apiOrigin);

  console.log(`[${agentId}] calling subscribe(serviceLevelId=${FREE_TIER_SERVICE_LEVEL_ID}, weeks=${SUBSCRIPTION_WEEKS}) on-chain...`);
  const { program, connection } = createProgram(config, payer);
  const txSig = await subscribeOnChain({
    program,
    connection,
    payer,
    tokenMint: config.txlTokenMint,
    serviceLevelId: FREE_TIER_SERVICE_LEVEL_ID,
    weeks: SUBSCRIPTION_WEEKS,
  });
  console.log(`[${agentId}] subscribe confirmed: ${txSig}`);

  console.log(`[${agentId}] activating API token...`);
  const apiToken = await activateApiToken(config.apiBaseUrl, jwt, payer, txSig, []);
  console.log(`[${agentId}] API token activated`);

  const sessionPath = join(REPO_ROOT, "secrets", `${agentId}-session.json`);
  writeFileSync(
    sessionPath,
    JSON.stringify(
      {
        agentId,
        network,
        walletPubkey: payer.publicKey.toBase58(),
        subscribeTxSig: txSig,
        jwt,
        apiToken,
        activatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`[${agentId}] session persisted to ${sessionPath}`);

  if (env.DATABASE_URL) {
    const client = new Client({ connectionString: env.DATABASE_URL, ssl: resolveDatabaseSsl(env.DATABASE_URL) });
    await client.connect();
    try {
      await client.query("UPDATE agents SET wallet_pubkey = $1 WHERE id = $2", [payer.publicKey.toBase58(), agentId]);
      console.log(`[${agentId}] wallet_pubkey persisted to agents table`);
    } finally {
      await client.end();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
