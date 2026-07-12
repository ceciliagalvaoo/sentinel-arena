import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Network = "mainnet" | "devnet";

export interface NetworkConfig {
  network: Network;
  rpcUrl: string;
  apiOrigin: string;
  apiBaseUrl: string;
  jwtUrl: string;
  programId: PublicKey;
  txlTokenMint: PublicKey;
  usdtMint: PublicKey;
  /**
   * Loaded from idl/{network}/txoracle.json at runtime (kept outside `src/`
   * so it isn't part of the TS build's rootDir — see idl/devnet/txoracle.ts
   * for a hand-generated, fully-typed reference if stronger typing is ever
   * needed). Mainnet's IDL (v1.5.5) is a strict subset of devnet's (v1.5.6,
   * adds validate_stat_v3); everything this codebase uses (subscribe,
   * validateStatV2) is present on both.
   */
  idl: Idl;
}

interface StaticNetworkConfig {
  rpcUrl: string;
  apiOrigin: string;
  programId: PublicKey;
  txlTokenMint: PublicKey;
  usdtMint: PublicKey;
  idlPath: string;
}

const NETWORKS: Record<Network, StaticNetworkConfig> = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
    txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
    usdtMint: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
    idlPath: join(__dirname, "..", "idl", "mainnet", "txoracle.json"),
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
    txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
    usdtMint: new PublicKey("ELWTKspHKCnCfCiCiqYw1EDH77k8VCP74dK9qytG2Ujh"),
    idlPath: join(__dirname, "..", "idl", "devnet", "txoracle.json"),
  },
};

/**
 * Golden rule (architecture doc section 5.1): RPC, program ID, mint, JWT and
 * API host must all come from the SAME network. This function is the only
 * place network values are assembled — never hardcode a cluster URL or
 * program ID anywhere else in this codebase.
 */
export function getNetworkConfig(network: Network): NetworkConfig {
  const base = NETWORKS[network];
  const idl = JSON.parse(readFileSync(base.idlPath, "utf8")) as Idl;
  return {
    network,
    rpcUrl: base.rpcUrl,
    apiOrigin: base.apiOrigin,
    apiBaseUrl: `${base.apiOrigin}/api`,
    jwtUrl: `${base.apiOrigin}/auth/guest/start`,
    programId: base.programId,
    txlTokenMint: base.txlTokenMint,
    usdtMint: base.usdtMint,
    idl,
  };
}

export function resolveNetworkFromEnv(env: NodeJS.ProcessEnv = process.env): Network {
  const raw = env.NETWORK;
  if (raw !== "mainnet" && raw !== "devnet") {
    throw new Error(`NETWORK env var must be "mainnet" or "devnet", got: ${JSON.stringify(raw)}`);
  }
  return raw;
}
