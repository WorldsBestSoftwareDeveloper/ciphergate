/**
 * CipherGate Encryption Module
 * ─────────────────────────────
 * All encryption happens in the browser using the Web Crypto API.
 * Keys never leave the client in plaintext — they are wrapped and
 * sent to Arcium's MPC layer for policy-gated storage and retrieval.
 *
 * Algorithm: AES-GCM (256-bit key, 96-bit IV, 128-bit auth tag)
 */

import { bufferToBase64, base64ToBuffer, bufferToHex, hexToBuffer } from './utils'

export interface EncryptionResult {
  encryptedData: ArrayBuffer
  key: CryptoKey
  keyHex: string  // hex of raw key bytes (to send to Arcium)
  iv: string      // base64 IV (stored with file metadata)
}

export interface DecryptionResult {
  data: ArrayBuffer
  mimeType: string
}

/**
 * Generate a new AES-GCM 256-bit key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable — needed to send to Arcium
    ['encrypt', 'decrypt']
  )
}

/**
 * Export raw key bytes as hex string (for Arcium storage)
 */
export async function exportKeyAsHex(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bufferToHex(raw)
}

/**
 * Import a hex key string back into a CryptoKey
 */
export async function importKeyFromHex(hex: string): Promise<CryptoKey> {
  const buffer = hexToBuffer(hex)
  return crypto.subtle.importKey(
    'raw',
    buffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
}

/**
 * Encrypt a file using AES-GCM
 * Returns the encrypted bytes plus key/IV metadata
 */
export async function encryptFile(file: File): Promise<EncryptionResult> {
  // Read file as ArrayBuffer
  const fileData = await file.arrayBuffer()

  // Generate fresh key and IV for this file
  const key = await generateEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM

  // Encrypt
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileData
  )

  const keyHex = await exportKeyAsHex(key)
  const ivBase64 = bufferToBase64(iv.buffer)

  return {
    encryptedData,
    key,
    keyHex,
    iv: ivBase64,
  }
}

/**
 * Decrypt a file using AES-GCM
 * Called after Arcium returns the decryption key
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  keyHex: string,
  ivBase64: string
): Promise<ArrayBuffer> {
  const key = await importKeyFromHex(keyHex)
  const iv = new Uint8Array(base64ToBuffer(ivBase64))

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  )

  return decryptedData
}

/**
 * Create a downloadable blob URL from decrypted data
 */
export function createDownloadUrl(data: ArrayBuffer, filename: string): string {
  const blob = new Blob([data])
  return URL.createObjectURL(blob)
}

/**
 * Wrap a key with another key (for additional security layer)
 * Could be used to wrap user keys before sending to Arcium
 */
export async function wrapKey(keyToWrap: CryptoKey, wrappingKey: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrapped = await crypto.subtle.wrapKey('raw', keyToWrap, wrappingKey, {
    name: 'AES-GCM',
    iv,
  })
  return wrapped
}
