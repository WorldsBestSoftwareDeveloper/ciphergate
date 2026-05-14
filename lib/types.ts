export interface AccessPolicy {
  price: number              // lamports
  expiryHours: number | null // null = no expiry
  maxDecryptions: number | null // null = unlimited
}

export interface Asset {
  id: string                 // on-chain account pubkey (stringified)
  title: string
  description?: string
  owner: string              // wallet pubkey
  cid: string               // IPFS CID of encrypted file
  price: number             // lamports
  policy: AccessPolicy
  policyId: string          // Arcium policy identifier
  fileType?: string
  fileSize?: number
  createdAt: number         // unix timestamp
}

export interface AccessRecord {
  id: string
  user: string
  assetId: string
  uses: number
  expiry: number            // unix timestamp
  purchasedAt: number
}

export interface EncryptedBundle {
  cid: string               // IPFS CID of encrypted file
  iv: string                // base64 AES-GCM iv
  policyId: string
}

export interface ArciumPolicy {
  policyId: string
  encryptedKey: string      // hex encoded wrapped key (simulated)
  conditions: {
    maxDecryptions: number | null
    expiryHours: number | null
  }
  usageCount: number
  authorizedUsers: string[]  // pubkeys
  revokedUsers: string[]
}
