# CipherGate

Encrypted file access control prototype built with Next.js, Solana/Anchor, and Arcium.

CipherGate lets a creator encrypt a file in the browser, publish a priced listing, and let authorized users decrypt the file after access checks. The current submission is a working frontend demo plus a compiling Arcium encrypted computation scaffold.

## Current Status

- Next.js app builds and runs locally.
- Files are encrypted client-side with AES-GCM before storage.
- Marketplace listings and access records are stored in browser storage for demo mode.
- IPFS is simulated with browser-local storage unless a storage token/provider is added.
- Arcium is simulated in the frontend for the demo flow.
- A real Arcium workspace exists in `ciphergate_mxe`.
- `ciphergate_mxe` contains a CipherGate-specific encrypted instruction, `release_key_shard`.
- `arcium build` passes for `release_key_shard`.
- Full Arcium localnet runtime testing is not yet passing because Arcium localnet startup stalls/timeouts in WSL.

## Demo Flow

1. Connect Phantom on Solana devnet.
2. Upload a file.
3. The browser encrypts the file with AES-GCM.
4. The encrypted file is stored in local demo storage.
5. A marketplace listing is created in browser storage.
6. The owner can decrypt/download in local test mode.
7. A second wallet can test the simulated purchase/access flow.

## Tech Stack

- Next.js 14
- React 18
- Tailwind CSS
- Solana wallet adapter
- Solana/Anchor program scaffold
- Arcium CLI/MXE scaffold
- Browser Web Crypto API

## Local App Setup

Use npm:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Build:

```bash
npm run build
```

## Environment

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Important defaults:

```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_ARCIUM_CLUSTER_OFFSET=456
NEXT_PUBLIC_ARCIUM_ENDPOINT=DEMO_MODE
```

`DEMO_MODE` means the frontend uses simulated MPC behavior until the Arcium runtime integration is completed.

## Arcium Work

The generated Arcium workspace is:

```text
ciphergate_mxe/
```

The current encrypted instruction is:

```text
release_key_shard
```

It accepts an encrypted key shard and an encrypted authorization flag. It releases the shard only when the authorization flag is `1`.

Recommended WSL workflow:

```bash
cd ~/ciphergate_mxe
arcium build
```

Known state:

- `arcium build` passes.
- `arcium test` currently stalls during Arcium localnet startup.
- Plain `solana-test-validator --reset` works from WSL native storage.

## Production Roadmap

- Deploy the Anchor marketplace/access program to Solana devnet.
- Replace browser-local listings with Anchor account reads/writes.
- Add a real IPFS/storage provider for encrypted ciphertext.
- Deploy or run the Arcium MXE runtime successfully.
- Replace `lib/arcium.ts` demo functions with real Arcium client calls.
- Remove the owner self-decrypt shortcut before public production use.

## Submission Note

CipherGate is currently a prototype/demo MVP. It demonstrates the product flow and contains a compiling Arcium encrypted computation, but the live frontend still uses simulated Arcium behavior until runtime MPC execution is completed.
