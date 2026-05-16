'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { Header } from '@/components/Header'
import { LoadingSpinner, SkeletonCard } from '@/components/LoadingStates'
import { Asset, AccessRecord } from '@/lib/types'
import { getAsset, getAccessRecord, createAccessRecord, deleteAsset, incrementUsage, isAccessValid } from '@/lib/store'
import { authorizeUser, requestDecryptionKey } from '@/lib/arcium'
import { fetchFromIPFS } from '@/lib/ipfs'
import { decryptFile, createDownloadUrl } from '@/lib/encryption'
import { transferSOL, explorerTxLink, shortSig } from '@/lib/solana'
import { signLocalAttestation } from '@/lib/walletAttestation'
import { lamportsToSol, truncateAddress, formatExpiry, formatFileSize } from '@/lib/utils'
import {
  Lock, Unlock, Shield, Clock, Repeat, User, ExternalLink,
  Download, AlertCircle, CheckCircle, X, RotateCcw, Ban
} from 'lucide-react'
import { revokeAccess } from '@/lib/arcium'
import { PublicKey } from '@solana/web3.js'

type FlowStep = 'idle' | 'paying' | 'authorizing' | 'fetching' | 'decrypting' | 'done' | 'error'

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { publicKey, connected, signTransaction } = useWallet()
  const { connection } = useConnection()

  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessRecord, setAccessRecord] = useState<AccessRecord | null>(null)

  const [step, setStep] = useState<FlowStep>('idle')
  const [error, setError] = useState('')
  const [txSig, setTxSig] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [decryptedName, setDecryptedName] = useState('')

  // Revoke state (for owner)
  const [revokeTarget, setRevokeTarget] = useState('')
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    const a = getAsset(id)
    setAsset(a)
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (!publicKey || !asset) return
    const record = getAccessRecord(publicKey.toBase58(), asset.id)
    setAccessRecord(record)
  }, [publicKey, asset])

  const isOwner = asset && publicKey && asset.owner === publicKey.toBase58()
  const hasPurchased = !!accessRecord
  const accessStatus = accessRecord && asset ? isAccessValid(accessRecord, asset) : null
  const canDecrypt = !!isOwner || !!accessStatus?.valid

  // ─── Purchase Flow ───────────────────────────────────────────────────

  const handlePurchase = async () => {
    if (!asset || !publicKey || !signTransaction) return
    setStep('paying')
    setError('')

    try {
      // Send SOL to asset owner on devnet
      const sig = await transferSOL(
        connection,
        publicKey,
        new PublicKey(asset.owner),
        asset.price,
        signTransaction
      )
      setTxSig(sig)

      // Authorize user in Arcium MPC
      setStep('authorizing')
      await authorizeUser(asset.policyId, publicKey.toBase58())

      // Create local access record
      createAccessRecord(publicKey.toBase58(), asset.id, asset.policy.expiryHours)
      const record = getAccessRecord(publicKey.toBase58(), asset.id)
      setAccessRecord(record)

      setStep('idle')
    } catch (err: any) {
      setError(err.message ?? 'Purchase failed')
      setStep('error')
    }
  }

  // ─── Decrypt Flow ────────────────────────────────────────────────────

  const handleDecrypt = async () => {
    if (!asset || !publicKey || !signTransaction) return

    if (!isOwner) {
      if (!accessRecord) return

      const validity = isAccessValid(accessRecord, asset)
      if (!validity.valid) {
        setError(validity.reason ?? 'Access not valid')
        setStep('error')
        return
      }
    }

    setStep('fetching')
    setError('')
    setDownloadUrl('')

    try {
      await signLocalAttestation(connection, publicKey, signTransaction, 'decrypt', asset.title)

      // 1. Request key from Arcium (policy checks happen inside MPC)
      const keyHex = await requestDecryptionKey(
        publicKey.toBase58(),
        asset.policyId,
        asset.id
      )

      // 2. Fetch encrypted file from IPFS
      const encryptedData = await fetchFromIPFS(asset.cid)

      // 3. Get the IV stored at upload time
      const iv = localStorage.getItem(`ciphergate:iv:${asset.id}`)
      if (!iv) throw new Error('Decryption IV not found — ensure you uploaded from this device')

      // 4. Decrypt in browser
      setStep('decrypting')
      const decryptedData = await decryptFile(encryptedData, keyHex, iv)

      // 5. Track usage
      if (accessRecord) {
        incrementUsage(publicKey.toBase58(), asset.id)
        const updated = getAccessRecord(publicKey.toBase58(), asset.id)
        setAccessRecord(updated)
      }

      // 6. Create download URL
      const url = createDownloadUrl(decryptedData, asset.title)
      setDownloadUrl(url)
      setDecryptedName(asset.title)
      setStep('done')

    } catch (err: any) {
      setError(err.message ?? 'Decryption failed')
      setStep('error')
    }
  }

  // ─── Revoke ──────────────────────────────────────────────────────────

  const handleRevoke = async () => {
    if (!asset || !publicKey || !revokeTarget.trim()) return
    setRevoking(true)
    try {
      await revokeAccess(asset.policyId, revokeTarget.trim(), publicKey.toBase58())
      setRevokeTarget('')
      alert('Access revoked successfully')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setRevoking(false)
    }
  }

  const handleDeleteAsset = () => {
    if (!asset || !isOwner) return
    const ok = window.confirm('Remove this local demo listing from this browser?')
    if (!ok) return

    deleteAsset(asset.id)
    router.push('/')
  }

  const isProcessing = ['paying', 'authorizing', 'fetching', 'decrypting'].includes(step)

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <SkeletonCard />
        </main>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="glass p-8 text-center">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <h2 className="font-bold text-lg">Asset Not Found</h2>
            <p className="text-text-secondary text-sm mt-1">This asset does not exist or has been removed.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Asset Header Card */}
        <div className="glass p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <Lock size={22} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-extrabold text-xl mb-1 break-words">{asset.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge-devnet text-[10px]">Devnet</span>
                <span className="text-xs text-text-secondary font-mono flex items-center gap-1">
                  <User size={10} />
                  {truncateAddress(asset.owner)}
                  {isOwner && <span className="text-primary ml-1 font-semibold">(you)</span>}
                </span>
              </div>
            </div>
          </div>

          {asset.description && (
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">{asset.description}</p>
          )}

          {/* Policy tags */}
          <div className="flex flex-wrap gap-2">
            {asset.policy.expiryHours && (
              <span className="flex items-center gap-1.5 text-xs bg-surface border border-border px-3 py-1 rounded-full">
                <Clock size={11} className="text-text-secondary" />
                Expires in {formatExpiry(asset.policy.expiryHours)}
              </span>
            )}
            {asset.policy.maxDecryptions && (
              <span className="flex items-center gap-1.5 text-xs bg-surface border border-border px-3 py-1 rounded-full">
                <Repeat size={11} className="text-text-secondary" />
                {asset.policy.maxDecryptions} decryptions max
              </span>
            )}
            {asset.fileSize && (
              <span className="text-xs bg-surface border border-border px-3 py-1 rounded-full">
                {formatFileSize(asset.fileSize)}
              </span>
            )}
          </div>
        </div>

        {/* Price + Actions */}
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-text-secondary uppercase tracking-wider mb-0.5">Access Price</p>
              <p className="text-3xl font-extrabold text-primary">
                {lamportsToSol(asset.price)}
                <span className="text-lg text-text-secondary ml-1">SOL</span>
              </p>
            </div>

            {/* Access status badge */}
            {hasPurchased && accessStatus && (
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border
                ${accessStatus.valid
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                {accessStatus.valid ? '✓ Access Valid' : `✗ ${accessStatus.reason}`}
              </div>
            )}
          </div>

          {/* Usage counter */}
          {accessRecord && asset.policy.maxDecryptions && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-text-secondary">Uses remaining</span>
                <span className="font-mono">
                  {asset.policy.maxDecryptions - accessRecord.uses} / {asset.policy.maxDecryptions}
                </span>
              </div>
              <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${((asset.policy.maxDecryptions - accessRecord.uses) / asset.policy.maxDecryptions) * 100}%`
                  }}
                />
              </div>
            </div>
          )}

          {!connected ? (
            <p className="text-center text-sm text-text-secondary py-3">
              Connect wallet to purchase
            </p>
          ) : isOwner ? (
            <div className="space-y-3">
              <div className="text-center p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-sm text-primary font-semibold">Owner test access enabled</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  IPFS CID: <span className="font-mono text-accent">{asset.cid.slice(0, 20)}...</span>
                </p>
              </div>

              {step === 'done' && downloadUrl ? (
                <a
                  href={downloadUrl}
                  download={decryptedName}
                  className="btn-accent w-full flex items-center justify-center gap-2 py-3.5"
                >
                  <Download size={16} />
                  Download Decrypted File
                </a>
              ) : (
                <button
                  onClick={handleDecrypt}
                  disabled={isProcessing || !canDecrypt}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
                >
                  {step === 'fetching' ? (
                    <><LoadingSpinner size={16} /> Fetching from IPFS...</>
                  ) : step === 'decrypting' ? (
                    <><LoadingSpinner size={16} /> Decrypting...</>
                  ) : (
                    <><Unlock size={16} /> Decrypt &amp; Download</>
                  )}
                </button>
              )}
            </div>
          ) : !hasPurchased ? (
            <button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
            >
              {step === 'paying' ? (
                <><LoadingSpinner size={16} /> Sending payment...</>
              ) : step === 'authorizing' ? (
                <><LoadingSpinner size={16} /> Updating Arcium MPC...</>
              ) : (
                <><Lock size={16} /> Unlock for {lamportsToSol(asset.price)} SOL</>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              {step === 'done' && downloadUrl ? (
                <a
                  href={downloadUrl}
                  download={decryptedName}
                  className="btn-accent w-full flex items-center justify-center gap-2 py-3.5"
                >
                  <Download size={16} />
                  Download Decrypted File
                </a>
              ) : (
                <button
                  onClick={handleDecrypt}
                  disabled={isProcessing || !canDecrypt}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
                >
                  {step === 'fetching' ? (
                    <><LoadingSpinner size={16} /> Fetching from IPFS...</>
                  ) : step === 'decrypting' ? (
                    <><LoadingSpinner size={16} /> Decrypting...</>
                  ) : (
                    <><Unlock size={16} /> Decrypt &amp; Download</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Tx link */}
          {txSig && (
            <a
              href={explorerTxLink(txSig)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-text-secondary hover:text-accent mt-3 transition-colors"
            >
              <ExternalLink size={11} />
              Tx: {shortSig(txSig)}
            </a>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mt-3">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-red-400 font-semibold">Error</p>
                <p className="text-xs text-text-secondary mt-0.5">{error}</p>
              </div>
              <button onClick={() => setStep('idle')} className="text-text-secondary hover:text-text-primary">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Arcium Policy Info */}
        <div className="glass p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-primary" />
            <h3 className="font-bold text-sm">Arcium MPC Policy</h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mb-3">
            The decryption key is stored in Arcium&apos;s threshold MPC network.
            Access is enforced cryptographically — no single party controls the key.
          </p>
          <div className="space-y-2">
            <PolicyRow icon={<CheckCircle size={12} />} label="Payment Verification" value="On-chain" />
            <PolicyRow icon={<Clock size={12} />} label="Expiry Enforcement" value={asset.policy.expiryHours ? `${formatExpiry(asset.policy.expiryHours)} after purchase` : 'None'} />
            <PolicyRow icon={<Repeat size={12} />} label="Usage Metering" value={asset.policy.maxDecryptions ? `${asset.policy.maxDecryptions} decryptions` : 'Unlimited'} />
            <PolicyRow icon={<Ban size={12} />} label="Revocation" value="Supported" />
          </div>
        </div>

        {/* Owner Controls — Revoke Access */}
        {isOwner && (
          <div className="glass p-5">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Ban size={16} className="text-red-400" />
              Revoke Access
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Enter a wallet address to revoke their access. Future decrypt attempts will fail in Arcium.
            </p>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="Wallet pubkey..."
                value={revokeTarget}
                onChange={e => setRevokeTarget(e.target.value)}
              />
              <button
                onClick={handleRevoke}
                disabled={revoking || !revokeTarget.trim()}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {revoking ? <LoadingSpinner size={14} /> : 'Revoke'}
              </button>
            </div>
          </div>
        )}

        {isOwner && (
          <div className="glass p-5">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <X size={16} className="text-red-400" />
              Remove Local Listing
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Delete this demo asset, its local IV, and local access records from this browser.
            </p>
            <button
              onClick={handleDeleteAsset}
              className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold transition-all"
            >
              Remove Listing
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function PolicyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-text-secondary">
        <span className="text-primary/60">{icon}</span>
        {label}
      </span>
      <span className="font-semibold text-text-primary">{value}</span>
    </div>
  )
}
