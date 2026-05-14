/**
 * CipherGate — Asset Store
 * ─────────────────────────
 * Simulates on-chain asset registry for demo/devnet.
 *
 * In production, assets are stored in Anchor program accounts (PDAs).
 * The `create_asset` instruction writes an Asset account on-chain.
 * The marketplace fetches all Asset accounts via `connection.getProgramAccounts()`.
 *
 * This module:
 *   - Stores assets in localStorage (mirrors on-chain state for demo)
 *   - Exposes the same interface the real on-chain fetch would use
 *   - Tracks purchase records (mirrors AccessRecord on-chain accounts)
 */

import { Asset, AccessRecord } from './types'
import { generateId } from './utils'

const ASSETS_KEY = 'ciphergate:assets'
const RECORDS_KEY = 'ciphergate:access_records'

// ─── Asset CRUD ───────────────────────────────────────────────────────────

export function saveAsset(asset: Asset): void {
  const assets = getAllAssets()
  const idx = assets.findIndex(a => a.id === asset.id)
  if (idx >= 0) {
    assets[idx] = asset
  } else {
    assets.unshift(asset) // newest first
  }
  localStorage.setItem(ASSETS_KEY, JSON.stringify(assets))
}

export function getAllAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(ASSETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getAsset(id: string): Asset | null {
  return getAllAssets().find(a => a.id === id) ?? null
}

export function getAssetsByOwner(ownerPubkey: string): Asset[] {
  return getAllAssets().filter(a => a.owner === ownerPubkey)
}

export function deleteAsset(assetId: string): void {
  const assets = getAllAssets().filter(a => a.id !== assetId)
  const records = getAllAccessRecords().filter(r => r.assetId !== assetId)

  localStorage.setItem(ASSETS_KEY, JSON.stringify(assets))
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))

  try {
    localStorage.removeItem(`ciphergate:iv:${assetId}`)
  } catch {}
}

export function createAsset(params: Omit<Asset, 'id' | 'createdAt'>): Asset {
  const asset: Asset = {
    ...params,
    id: generateId(),
    createdAt: Date.now(),
  }
  saveAsset(asset)
  return asset
}

// ─── Access Records ───────────────────────────────────────────────────────

export function saveAccessRecord(record: AccessRecord): void {
  const records = getAllAccessRecords()
  const idx = records.findIndex(
    r => r.user === record.user && r.assetId === record.assetId
  )
  if (idx >= 0) {
    records[idx] = record
  } else {
    records.push(record)
  }
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
}

export function getAllAccessRecords(): AccessRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getAccessRecord(userPubkey: string, assetId: string): AccessRecord | null {
  return getAllAccessRecords().find(
    r => r.user === userPubkey && r.assetId === assetId
  ) ?? null
}

export function getPurchasedAssets(userPubkey: string): { record: AccessRecord; asset: Asset }[] {
  const records = getAllAccessRecords().filter(r => r.user === userPubkey)
  const result: { record: AccessRecord; asset: Asset }[] = []
  for (const record of records) {
    const asset = getAsset(record.assetId)
    if (asset) result.push({ record, asset })
  }
  return result
}

export function createAccessRecord(
  userPubkey: string,
  assetId: string,
  expiryHours: number | null
): AccessRecord {
  const record: AccessRecord = {
    id: generateId(),
    user: userPubkey,
    assetId,
    uses: 0,
    expiry: expiryHours
      ? Date.now() + expiryHours * 60 * 60 * 1000
      : 9999999999999, // far future = no expiry
    purchasedAt: Date.now(),
  }
  saveAccessRecord(record)
  return record
}

export function incrementUsage(userPubkey: string, assetId: string): void {
  const record = getAccessRecord(userPubkey, assetId)
  if (!record) return
  record.uses += 1
  saveAccessRecord(record)
}

export function isAccessValid(
  record: AccessRecord,
  asset: Asset
): { valid: boolean; reason?: string } {
  if (Date.now() > record.expiry) {
    return { valid: false, reason: 'Access has expired' }
  }
  if (
    asset.policy.maxDecryptions !== null &&
    record.uses >= asset.policy.maxDecryptions
  ) {
    return { valid: false, reason: `Usage limit reached (${asset.policy.maxDecryptions} uses)` }
  }
  return { valid: true }
}
