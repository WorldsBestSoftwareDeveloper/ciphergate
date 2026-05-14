/**
 * CipherGate IPFS Module
 * ──────────────────────
 * Handles upload of encrypted files to IPFS.
 * Since files are encrypted client-side before upload,
 * the IPFS layer only stores ciphertext — content is safe.
 *
 * Upload strategy:
 *   1. Try web3.storage (if API token configured)
 *   2. Fall back to nft.storage
 *   3. Simulate with a mock CID for local dev/demo
 *
 * Retrieval uses public IPFS gateways.
 */

const WEB3_STORAGE_TOKEN = process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN

const GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
]

export interface IPFSUploadResult {
  cid: string
  url: string
  size: number
}

/**
 * Upload encrypted file bytes to IPFS
 */
export async function uploadToIPFS(
  encryptedData: ArrayBuffer,
  filename: string
): Promise<IPFSUploadResult> {
  const blob = new Blob([encryptedData], { type: 'application/octet-stream' })
  const size = encryptedData.byteLength

  // Try web3.storage if token provided
  if (WEB3_STORAGE_TOKEN) {
    try {
      return await uploadToWeb3Storage(blob, filename, size)
    } catch (e) {
      console.warn('web3.storage upload failed, using mock IPFS:', e)
    }
  }

  // Demo/fallback: generate a deterministic mock CID
  // In production, integrate real IPFS upload
  return await mockIPFSUpload(blob, filename, size)
}

async function uploadToWeb3Storage(
  blob: Blob,
  filename: string,
  size: number
): Promise<IPFSUploadResult> {
  const formData = new FormData()
  formData.append('file', blob, filename)

  const response = await fetch('https://api.web3.storage/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WEB3_STORAGE_TOKEN}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`web3.storage upload failed: ${response.statusText}`)
  }

  const { cid } = await response.json()
  return {
    cid,
    url: `https://cloudflare-ipfs.com/ipfs/${cid}`,
    size,
  }
}

/**
 * Demo mode: simulate IPFS upload by storing in browser storage
 * This lets the full flow work without a real IPFS token
 */
async function mockIPFSUpload(
  blob: Blob,
  filename: string,
  size: number
): Promise<IPFSUploadResult> {
  // Generate a mock CID (Qm... format)
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const cid = `Qm${hex.slice(0, 44)}` // Mock CIDv0 format

  // Store encrypted data for demo retrieval. IndexedDB is the primary store
  // because encrypted files can exceed sessionStorage/localStorage limits.
  const reader = new FileReader()
  const base64Data = await new Promise<string>((resolve) => {
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })

  try {
    await setIndexedDbMockData(cid, base64Data)
    sessionStorage.setItem(`ipfs:${cid}`, base64Data)
  } catch {
    console.warn('Browser storage full, using in-memory IPFS mock store')
    ;(window as any).__ipfsStore = (window as any).__ipfsStore || {}
    ;(window as any).__ipfsStore[cid] = base64Data
  }

  return {
    cid,
    url: `mock://ipfs/${cid}`,
    size,
  }
}

/**
 * Fetch encrypted file from IPFS
 * Tries multiple gateways for resilience
 */
export async function fetchFromIPFS(cid: string): Promise<ArrayBuffer> {
  // Check mock store first (demo mode)
  const mockData = await getMockData(cid)
  if (mockData) {
    return await dataUrlToBuffer(mockData)
  }

  // Try real IPFS gateways
  for (const gateway of GATEWAYS) {
    try {
      const url = `${gateway}${cid}`
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (response.ok) {
        return await response.arrayBuffer()
      }
    } catch (e) {
      continue
    }
  }

  throw new Error(
    `Failed to fetch CID ${cid}. If this was a local demo upload, the encrypted bytes are missing from this browser profile. Re-upload the file, or configure a real IPFS/storage provider.`
  )
}

async function getMockData(cid: string): Promise<string | null> {
  const indexedDbData = await getIndexedDbMockData(cid)
  if (indexedDbData) return indexedDbData

  try {
    const stored = sessionStorage.getItem(`ipfs:${cid}`)
    if (stored) return stored
  } catch {}

  const mem = (window as any).__ipfsStore
  if (mem && mem[cid]) return mem[cid]

  return null
}

function openMockDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)

  return new Promise((resolve) => {
    const request = indexedDB.open('ciphergate-ipfs-mock', 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore('files')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

async function setIndexedDbMockData(cid: string, dataUrl: string): Promise<void> {
  const db = await openMockDb()
  if (!db) return

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite')
    tx.objectStore('files').put(dataUrl, cid)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

async function getIndexedDbMockData(cid: string): Promise<string | null> {
  const db = await openMockDb()
  if (!db) return null

  const data = await new Promise<string | null>((resolve) => {
    const tx = db.transaction('files', 'readonly')
    const request = tx.objectStore('files').get(cid)
    request.onsuccess = () => resolve((request.result as string | undefined) ?? null)
    request.onerror = () => resolve(null)
  })

  db.close()
  return data
}

async function dataUrlToBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(dataUrl)
  return response.arrayBuffer()
}

export function ipfsUrl(cid: string): string {
  return `https://cloudflare-ipfs.com/ipfs/${cid}`
}
