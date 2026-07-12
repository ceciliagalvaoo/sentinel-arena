import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import { getPricingMatrixPda, getTokenTreasuryPda } from "./pda.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensures the payer has a Token-2022 Associated Token Account for `tokenMint`
 * before subscribing — the `subscribe` instruction requires this account to
 * already exist even on the free tier (no tokens are actually charged, but
 * the account is still a required, writable instruction account).
 */
export async function ensureUserTokenAccount(
  connection: Connection,
  payer: Keypair,
  tokenMint: PublicKey,
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(tokenMint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const accountInfo = await connection.getAccountInfo(ata);
  if (!accountInfo) {
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        payer.publicKey,
        tokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
    await sleep(3000); // give the RPC time to observe the new account before subscribe() reads it
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID);
      return ata;
    } catch (err) {
      if (err instanceof TokenAccountNotFoundError) {
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`RPC failed to sync the new Token-2022 account (${ata.toBase58()}) after 5 attempts`);
}

export interface SubscribeParams {
  program: anchor.Program;
  connection: Connection;
  payer: Keypair;
  tokenMint: PublicKey;
  serviceLevelId: number;
  weeks: number;
}

/** Calls the TxLINE `subscribe` instruction on-chain. Returns the confirmed tx signature. */
export async function subscribeOnChain(params: SubscribeParams): Promise<string> {
  const { program, connection, payer, tokenMint, serviceLevelId, weeks } = params;

  if (weeks < 4 || weeks % 4 !== 0) {
    throw new Error(`Invalid subscription duration: ${weeks} weeks — must be a multiple of 4, minimum 4`);
  }

  const userTokenAccount = await ensureUserTokenAccount(connection, payer, tokenMint);
  const [pricingMatrixPda] = getPricingMatrixPda(program.programId);
  const [tokenTreasuryPda] = getTokenTreasuryPda(program.programId);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    tokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // `program` is typed with the generic anchor.Idl (see program.ts) rather
  // than a literal generated IDL type, so `methods` is an index signature
  // and `noUncheckedIndexedAccess` requires the non-null assertion here —
  // the method is guaranteed to exist because subscribe is a real
  // instruction on both the mainnet and devnet TxLINE IDLs.
  const tx = await program.methods
    .subscribe!(serviceLevelId, weeks)
    .accounts({
      user: payer.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const txSig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature: txSig, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
    "confirmed",
  );

  return txSig;
}

/** Exact activation message format required by POST /api/token/activate — see architecture doc section 5.8. */
export function buildActivationMessage(txSig: string, leagues: number[], jwt: string): string {
  return `${txSig}:${leagues.join(",")}:${jwt}`;
}

export function signActivationMessage(payer: Keypair, message: string): string {
  const signatureBytes = nacl.sign.detached(new TextEncoder().encode(message), payer.secretKey);
  return Buffer.from(signatureBytes).toString("base64");
}

/**
 * POST /api/token/activate — the signing wallet MUST be the same one that
 * submitted `subscribe`, and the JWT must come from the same network host as
 * txSig (architecture doc "golden rule" + section 5.8 pitfalls).
 */
export async function activateApiToken(
  apiBaseUrl: string,
  jwt: string,
  payer: Keypair,
  txSig: string,
  leagues: number[] = [],
): Promise<string> {
  const message = buildActivationMessage(txSig, leagues, jwt);
  const walletSignature = signActivationMessage(payer, message);

  const response = await axios.post(
    `${apiBaseUrl}/token/activate`,
    { txSig, walletSignature, leagues },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  // The endpoint returns either a bare string body or { token: string }, per
  // the OpenAPI reference (section 5.19) — handle both.
  return typeof response.data === "string" ? response.data : response.data.token;
}
