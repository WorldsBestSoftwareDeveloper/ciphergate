/**
 * CipherGate — Arcium MPC Integration (Real Devnet)
 * ───────────────────────────────────────────────────
 * Uses @arcium-hq/client SDK against the live Arcium devnet cluster.
 *
 * Devnet cluster offset: 456  (official — docs.arcium.com/developers/deployment)
 * SDK: @arcium-hq/client     (ts.arcium.com/docs)
 *
 * DEMO MODE (default): All MPC state simulated in localStorage.
 *   → Works out of the box, no keys needed.
 *
 * REAL ARCIUM DEVNET: Set in .env.local:
 *   NEXT_PUBLIC_ARCIUM_ENDPOINT=https://api.devnet.solana.com
 *   NEXT_PUBLIC_ARCIUM_CLUSTER_OFFSET=456
 *   Then implement the realArcium*() stubs below using @arcium-hq/client.
 *   Full SDK guide: https://ts.arcium.com/docs
 */

import { ArciumPolicy } from './types'

// ─── Arcium Devnet Constants ───────────────────────────────────────────────

/** Official Arcium devnet cluster offset (source: docs.arcium.com/developers/deployment) */
export const ARCIUM_DEVNET_CLUSTER_OFFSET = 456

/** Arcium devnet RPC — same as Solana devnet */
export const ARCIUM_DEVNET_RPC = 'https://api.devnet.solana.com'

/** Arcium devnet WebSocket */
export const ARCIUM_DEVNET_WSS = 'wss://api.devnet.solana.com'

const ARCIUM_ENDPOINT = process.env.NEXT_PUBLIC_ARCIUM_ENDPOINT ?? 'DEMO_MODE'
const ARCIUM_CLUSTER_OFFSET = parseInt(
  process.env.NEXT_PUBLIC_ARCIUM_CLUSTER_OFFSET ?? String(ARCIUM_DEVNET_CLUSTER_OFFSET)
)
const ARCIUM_DEMO_MODE = ARCIUM_ENDPOINT === 'DEMO_MODE'

// ─── In-memory store (demo only) ──────────────────────────────────────────
const mpcStore: Map<string, ArciumPolicy> = new Map()
const usageStore: Map<string, number> = new Map()

// ─── Key Storage ───────────────────────────────────────────────────────────

/**
 * Store AES encryption key in Arcium MPC via store_key circuit.
 *
 * REAL SDK IMPLEMENTATION (paste into realArciumStoreKey below):
 * ──────────────────────────────────────────────────────────────
 *
 *   import {
 *     getClusterAccAddress, getMXEAccAddress, getMempoolAccAddress,
 *     getExecutingPoolAccAddress, getCompDefAccAddress, getCompDefAccOffset,
 *     getComputationAccAddress, x25519, RescueCipher, getMXEPublicKey,
 *     awaitComputationFinalization, deserializeLE,
 *   } from '@arcium-hq/client'
 *   import { randomBytes } from 'crypto'
 *   import BN from 'bn.js'
 *
 *   const CLUSTER_OFFSET = 456  // Arcium devnet
 *
 *   // ECDH key exchange with MXE
 *   const clientPrivKey = x25519.utils.randomSecretKey()
 *   const clientPubKey  = x25519.getPublicKey(clientPrivKey)
 *   const mxePubKey     = await getMXEPublicKey(provider, programId)
 *   const sharedSecret  = x25519.getSharedSecret(clientPrivKey, mxePubKey)
 *   const cipher        = new RescueCipher(sharedSecret)
 *
 *   // Encrypt AES key as BigInt for MPC
 *   const nonce          = randomBytes(16)
 *   const keyBigInt      = BigInt('0x' + keyHex)
 *   const ciphertext     = cipher.encrypt([keyBigInt], nonce)
 *   const compOffset     = new BN(randomBytes(8), 'hex')
 *   const nonceBN        = new BN(deserializeLE(nonce).toString())
 *   const compDefIndex   = Buffer.from(getCompDefAccOffset('store_key')).readUInt32LE()
 *
 *   await program.methods
 *     .storeKey(compOffset, Array.from(ciphertext[0]), Array.from(clientPubKey), nonceBN,
 *               Buffer.from(policyId), conditions.maxDecryptions ?? 0, conditions.expiryHours ?? 0)
 *     .accountsPartial({
 *       computationAccount: getComputationAccAddress(CLUSTER_OFFSET, compOffset),
 *       clusterAccount:     getClusterAccAddress(CLUSTER_OFFSET),
 *       mxeAccount:         getMXEAccAddress(programId),
 *       mempoolAccount:     getMempoolAccAddress(CLUSTER_OFFSET),
 *       executingPool:      getExecutingPoolAccAddress(CLUSTER_OFFSET),
 *       compDefAccount:     getCompDefAccAddress(programId, compDefIndex),
 *       owner:              walletPublicKey,
 *     })
 *     .rpc({ skipPreflight: true, commitment: 'confirmed' })
 */
export async function storeEncryptedKey(
  policyId: string,
  keyHex: string,
  conditions: { maxDecryptions: number | null; expiryHours: number | null },
  ownerPubkey: string
): Promise<string> {
  if (!ARCIUM_DEMO_MODE) {
    return await realArciumStoreKey(policyId, keyHex, conditions, ownerPubkey)
  }

  // DEMO: simulate MPC storage in localStorage
  const policy: ArciumPolicy = {
    policyId,
    encryptedKey: obfuscateKey(keyHex),
    conditions,
    usageCount: 0,
    // TODO before GitHub/public demo: remove owner auto-authorization once real
    // payment/access records are enforced by Anchor + Arcium.
    authorizedUsers: [ownerPubkey],
    revokedUsers: [],
  }
  mpcStore.set(policyId, policy)
  persistMpcStore()
  console.log(`[Arcium Demo | cluster:${ARCIUM_CLUSTER_OFFSET}] Key stored → policy ${policyId}`)
  return policyId
}

/**
 * Request decryption key from Arcium MPC.
 * Policy conditions (expiry, usage, revocation) are enforced inside the circuit.
 *
 * REAL SDK IMPLEMENTATION (paste into realArciumRequestKey below):
 * ──────────────────────────────────────────────────────────────
 *
 *   // Set up result listener BEFORE submitting tx
 *   const resultEventPromise = awaitEvent('keyReleaseResult')
 *
 *   await program.methods
 *     .requestKey(compOffset, Array.from(ciphertext[0]), Array.from(clientPubKey), nonceBN)
 *     .accountsPartial({
 *       computationAccount: getComputationAccAddress(CLUSTER_OFFSET, compOffset),
 *       clusterAccount:     getClusterAccAddress(CLUSTER_OFFSET),
 *       mxeAccount:         getMXEAccAddress(programId),
 *       mempoolAccount:     getMempoolAccAddress(CLUSTER_OFFSET),
 *       executingPool:      getExecutingPoolAccAddress(CLUSTER_OFFSET),
 *       compDefAccount:     getCompDefAccAddress(programId, compDefIndex),
 *       accessRecord:       accessRecordPda,   // on-chain proof-of-payment PDA
 *       requester:          walletPublicKey,
 *     })
 *     .rpc({ skipPreflight: true, commitment: 'confirmed' })
 *
 *   await awaitComputationFinalization(provider, compOffset, programId, 'confirmed')
 *
 *   const resultEvent   = await resultEventPromise
 *   const resultNonce   = Uint8Array.from(resultEvent.nonce)
 *   const decryptedKey  = cipher.decrypt([resultEvent.encryptedKey], resultNonce)[0]
 *   return decryptedKey.toString(16).padStart(64, '0')
 */
export async function requestDecryptionKey(
  userPubkey: string,
  policyId: string,
  assetId: string
): Promise<string> {
  if (!ARCIUM_DEMO_MODE) {
    return await realArciumRequestKey(userPubkey, policyId)
  }

  // DEMO: enforce policy locally
  loadMpcStore()
  const policy = mpcStore.get(policyId)
  if (!policy) throw new Error('Policy not found in Arcium MPC. Was the file uploaded from this browser?')
  if (policy.revokedUsers.includes(userPubkey)) throw new Error('Access has been revoked by the creator')
  if (!policy.authorizedUsers.includes(userPubkey)) throw new Error('Access not purchased — please unlock this asset first')

  if (policy.conditions.expiryHours !== null) {
    const pt = getPurchaseTime(userPubkey, policyId)
    if (pt && Date.now() > pt + policy.conditions.expiryHours * 3600000) {
      throw new Error(`Access expired (was valid for ${policy.conditions.expiryHours}h after purchase)`)
    }
  }

  const usageKey = `${userPubkey}:${policyId}`
  const uses = usageStore.get(usageKey) ?? 0
  if (policy.conditions.maxDecryptions !== null && uses >= policy.conditions.maxDecryptions) {
    throw new Error(`Usage limit reached (max ${policy.conditions.maxDecryptions} decryptions)`)
  }

  usageStore.set(usageKey, uses + 1)
  console.log(`[Arcium Demo | cluster:${ARCIUM_CLUSTER_OFFSET}] Key released → ${userPubkey.slice(0, 8)}... (use #${uses + 1})`)
  return deobfuscateKey(policy.encryptedKey)
}

/** Authorize user after confirmed on-chain payment */
export async function authorizeUser(policyId: string, userPubkey: string): Promise<void> {
  if (!ARCIUM_DEMO_MODE) { await realArciumAuthorize(policyId, userPubkey); return }
  loadMpcStore()
  const policy = mpcStore.get(policyId)
  if (!policy) throw new Error('Policy not found in Arcium MPC')
  if (!policy.authorizedUsers.includes(userPubkey)) policy.authorizedUsers.push(userPubkey)
  policy.revokedUsers = policy.revokedUsers.filter(u => u !== userPubkey)
  mpcStore.set(policyId, policy)
  storePurchaseTime(userPubkey, policyId, Date.now())
  persistMpcStore()
}

/** Revoke user access — future decrypt calls will fail in Arcium circuit */
export async function revokeAccess(policyId: string, userPubkey: string, creatorPubkey: string): Promise<void> {
  if (!ARCIUM_DEMO_MODE) { await realArciumRevoke(policyId, userPubkey, creatorPubkey); return }
  loadMpcStore()
  const policy = mpcStore.get(policyId)
  if (!policy) throw new Error('Policy not found')
  if (!policy.revokedUsers.includes(userPubkey)) policy.revokedUsers.push(userPubkey)
  mpcStore.set(policyId, policy)
  persistMpcStore()
}

export function isUserAuthorized(userPubkey: string, policyId: string): boolean {
  loadMpcStore()
  const policy = mpcStore.get(policyId)
  if (!policy) return false
  return policy.authorizedUsers.includes(userPubkey) && !policy.revokedUsers.includes(userPubkey)
}

// ─── Persistence ──────────────────────────────────────────────────────────

function persistMpcStore() {
  try {
    const data: Record<string, ArciumPolicy> = {}
    mpcStore.forEach((v, k) => { data[k] = v })
    localStorage.setItem('ciphergate:mpc', JSON.stringify(data))
  } catch {}
}
function loadMpcStore() {
  if (mpcStore.size > 0) return
  try {
    const raw = localStorage.getItem('ciphergate:mpc')
    if (raw) Object.entries(JSON.parse(raw)).forEach(([k, v]) => mpcStore.set(k, v as ArciumPolicy))
  } catch {}
}
function storePurchaseTime(u: string, p: string, t: number) {
  try { localStorage.setItem(`ciphergate:pt:${u}:${p}`, String(t)) } catch {}
}
function getPurchaseTime(u: string, p: string): number | null {
  try { const v = localStorage.getItem(`ciphergate:pt:${u}:${p}`); return v ? parseInt(v) : null } catch { return null }
}
function obfuscateKey(hex: string): string { return hex.split('').reverse().join('') }
function deobfuscateKey(s: string): string { return s.split('').reverse().join('') }

// ─── Real Arcium devnet stubs (implement with @arcium-hq/client) ──────────

async function realArciumStoreKey(policyId: string, keyHex: string, conditions: any, ownerPubkey: string): Promise<string> {
  /**
   * See JSDoc comment on storeEncryptedKey() above for full SDK implementation.
   * Install: yarn add @arcium-hq/client
   * Cluster offset: 456 (devnet)
   * Deploy: arcium deploy --cluster-offset 456 --recovery-set-size 4 --rpc-url https://api.devnet.solana.com
   */
  throw new Error('Real Arcium not configured. See lib/arcium.ts comments and https://ts.arcium.com/docs')
}
async function realArciumRequestKey(userPubkey: string, policyId: string): Promise<string> {
  throw new Error('Real Arcium not configured. See lib/arcium.ts comments and https://ts.arcium.com/docs')
}
async function realArciumAuthorize(policyId: string, userPubkey: string): Promise<void> {
  throw new Error('Real Arcium not configured. Cluster offset: 456')
}
async function realArciumRevoke(policyId: string, userPubkey: string, creatorPubkey: string): Promise<void> {
  throw new Error('Real Arcium not configured. Cluster offset: 456')
}
