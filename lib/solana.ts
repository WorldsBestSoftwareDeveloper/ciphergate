/**
 * CipherGate — Solana Utilities
 * ──────────────────────────────
 * Helpers for interacting with Solana devnet.
 * All operations target DEVNET only.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  Commitment,
} from '@solana/web3.js'

export const DEVNET_ENDPOINT = clusterApiUrl('devnet')
export const COMMITMENT: Commitment = 'confirmed'

/**
 * Request a SOL airdrop on devnet (2 SOL)
 * Only works on devnet — safe for testing
 */
export async function requestAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  sol = 2
): Promise<string> {
  const lamports = sol * LAMPORTS_PER_SOL
  const signature = await connection.requestAirdrop(publicKey, lamports)

  // Wait for confirmation
  const latestBlockhash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    signature,
    ...latestBlockhash,
  }, COMMITMENT)

  return signature
}

/**
 * Get wallet SOL balance
 */
export async function getBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const lamports = await connection.getBalance(publicKey, COMMITMENT)
  return lamports / LAMPORTS_PER_SOL
}

/**
 * Send SOL from one wallet to another (for purchase flow)
 * Returns the transaction signature
 */
export async function transferSOL(
  connection: Connection,
  senderPublicKey: PublicKey,
  recipientPublicKey: PublicKey,
  lamports: number,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: senderPublicKey,
  }).add(
    SystemProgram.transfer({
      fromPubkey: senderPublicKey,
      toPubkey: recipientPublicKey,
      lamports,
    })
  )

  const signed = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signed.serialize())

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    COMMITMENT
  )

  return signature
}

/**
 * Shorten a tx signature for display
 */
export function shortSig(sig: string): string {
  return `${sig.slice(0, 8)}...${sig.slice(-8)}`
}

/**
 * Solana Explorer link for a transaction
 */
export function explorerTxLink(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`
}

/**
 * Solana Explorer link for an address
 */
export function explorerAddressLink(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`
}
