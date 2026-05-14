# CipherGate Submission Checklist

## Before GitHub Push

- Confirm `npm run build` passes.
- Do not commit `.env.local`.
- Do not commit `node_modules`, `.next`, `target`, `artifacts`, `test-ledger`, or Arcium localnet output.
- Keep `ciphergate_mxe` source/config files, but avoid generated heavyweight runtime/build folders.
- Check `git status` before committing.

Useful cleanup checks:

```bash
git status --short
git status --ignored --short
```

Heavy paths that should stay ignored:

```text
node_modules/
.next/
ciphergate_mxe/node_modules/
ciphergate_mxe/target/
ciphergate_mxe/artifacts/
ciphergate_mxe/test-ledger/
program/target/
```

## Vercel

Use the root project directory:

```text
ciphergate
```

Build settings:

```text
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

Environment variables:

```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_ARCIUM_CLUSTER_OFFSET=456
NEXT_PUBLIC_ARCIUM_ENDPOINT=DEMO_MODE
```

## Demo Script

1. Open the app.
2. Connect Phantom on devnet.
3. Upload a small test file.
4. Open the generated asset.
5. Decrypt/download with the owner test mode.
6. Explain that Arcium frontend calls are simulated, while `ciphergate_mxe/release_key_shard` is the compiling real Arcium computation scaffold.
