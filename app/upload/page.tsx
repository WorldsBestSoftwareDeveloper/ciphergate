'use client'

import { useState, useRef, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Header } from '@/components/Header'
import { LoadingSpinner } from '@/components/LoadingStates'
import { encryptFile } from '@/lib/encryption'
import { uploadToIPFS } from '@/lib/ipfs'
import { storeEncryptedKey } from '@/lib/arcium'
import { createAsset } from '@/lib/store'
import { solToLamports, getFileType, formatFileSize, generateId } from '@/lib/utils'
import {
  Upload, Lock, Shield, Clock, Repeat, CheckCircle,
  File, X, AlertCircle, ExternalLink, Zap
} from 'lucide-react'

type Step = 'idle' | 'encrypting' | 'uploading' | 'arcium' | 'onchain' | 'done' | 'error'

interface StepInfo {
  label: string
  description: string
  icon: React.ReactNode
}

const STEPS: Record<string, StepInfo> = {
  encrypting: {
    label: 'Encrypting File',
    description: 'AES-256-GCM encryption in your browser',
    icon: <Lock size={16} />,
  },
  uploading: {
    label: 'Uploading to IPFS',
    description: 'Storing ciphertext on decentralized storage',
    icon: <Upload size={16} />,
  },
  arcium: {
    label: 'Storing Key in Arcium MPC',
    description: 'Threshold-splitting key across MPC nodes',
    icon: <Shield size={16} />,
  },
  onchain: {
    label: 'Publishing to Marketplace',
    description: 'Writing asset record to local registry',
    icon: <Zap size={16} />,
  },
}

export default function UploadPage() {
  const { publicKey, connected } = useWallet()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0.1')
  const [expiryHours, setExpiryHours] = useState<string>('24')
  const [maxDecryptions, setMaxDecryptions] = useState<string>('10')
  const [enableExpiry, setEnableExpiry] = useState(true)
  const [enableMaxUses, setEnableMaxUses] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Upload state
  const [step, setStep] = useState<Step>('idle')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ assetId: string; cid: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    setSelectedFile(file)
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [title])

  const handleUpload = async () => {
    if (!selectedFile || !publicKey || !title.trim()) return

    setStep('encrypting')
    setCompletedSteps([])
    setError('')

    try {
      // Step 1: Encrypt
      const { encryptedData, keyHex, iv } = await encryptFile(selectedFile)
      setCompletedSteps(p => [...p, 'encrypting'])

      // Step 2: Upload to IPFS
      setStep('uploading')
      const { cid } = await uploadToIPFS(encryptedData, `${title}.enc`)
      setCompletedSteps(p => [...p, 'uploading'])

      // Step 3: Store key in Arcium MPC
      setStep('arcium')
      const policyId = generateId()
      await storeEncryptedKey(
        policyId,
        keyHex,
        {
          maxDecryptions: enableMaxUses ? parseInt(maxDecryptions) : null,
          expiryHours: enableExpiry ? parseInt(expiryHours) : null,
        },
        publicKey.toBase58()
      )
      setCompletedSteps(p => [...p, 'arcium'])

      // Step 4: Publish to marketplace (on-chain in production)
      setStep('onchain')
      const asset = createAsset({
        title: title.trim(),
        description: description.trim() || undefined,
        owner: publicKey.toBase58(),
        cid,
        price: solToLamports(parseFloat(price)),
        policy: {
          price: solToLamports(parseFloat(price)),
          expiryHours: enableExpiry ? parseInt(expiryHours) : null,
          maxDecryptions: enableMaxUses ? parseInt(maxDecryptions) : null,
        },
        policyId,
        fileType: getFileType(selectedFile.name),
        fileSize: selectedFile.size,
      })

      // Store the IV with the asset for decryption
      localStorage.setItem(`ciphergate:iv:${asset.id}`, iv)

      setCompletedSteps(p => [...p, 'onchain'])
      setResult({ assetId: asset.id, cid })
      setStep('done')

    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
      setStep('error')
    }
  }

  const reset = () => {
    setStep('idle')
    setCompletedSteps([])
    setError('')
    setResult(null)
    setSelectedFile(null)
    setTitle('')
    setDescription('')
  }

  const isUploading = ['encrypting', 'uploading', 'arcium', 'onchain'].includes(step)

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold mb-1">Upload File</h1>
          <p className="text-text-secondary text-sm">
            Files are encrypted in your browser before leaving your device.
          </p>
        </div>

        {!connected ? (
          <div className="glass p-8 text-center">
            <Shield size={36} className="text-primary/50 mx-auto mb-3" />
            <h3 className="font-bold mb-2">Connect Wallet</h3>
            <p className="text-text-secondary text-sm">Connect your Phantom wallet to upload files.</p>
          </div>
        ) : step === 'done' && result ? (
          <SuccessView result={result} onReset={reset} />
        ) : (
          <div className="space-y-4">

            {/* File Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer
                ${dragOver ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 hover:bg-primary/5'}
                ${selectedFile ? 'border-primary/40 bg-primary/5' : ''}
              `}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {selectedFile ? (
                <div className="flex items-center gap-3 justify-center">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <File size={18} className="text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm truncate max-w-[200px]">{selectedFile.name}</p>
                    <p className="text-xs text-text-secondary">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    className="ml-2 text-text-secondary hover:text-red-400 transition-colors"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null) }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={28} className="text-primary/50 mx-auto mb-3" />
                  <p className="font-semibold mb-1">Drop file here or tap to browse</p>
                  <p className="text-xs text-text-secondary">Any file type · Encrypted before upload</p>
                </>
              )}
            </div>

            {/* Metadata */}
            <div className="glass p-5 space-y-4">
              <h3 className="font-bold text-sm text-text-secondary uppercase tracking-wider">File Details</h3>

              <div>
                <label className="block text-sm font-semibold mb-1.5">Title *</label>
                <input
                  className="input-field"
                  placeholder="My Private Document"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">Description</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  placeholder="What's in this file..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Access Policy */}
            <div className="glass p-5 space-y-4">
              <h3 className="font-bold text-sm text-text-secondary uppercase tracking-wider">Access Policy</h3>

              {/* Price */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Price (SOL)
                </label>
                <div className="relative">
                  <input
                    className="input-field pr-14"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary text-sm font-mono">SOL</span>
                </div>
              </div>

              {/* Expiry */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <Clock size={14} className="text-text-secondary" />
                    Time-Bound Access
                  </label>
                  <Toggle enabled={enableExpiry} onChange={setEnableExpiry} />
                </div>
                {enableExpiry && (
                  <div className="flex gap-2">
                    {[1, 24, 72, 168].map(h => (
                      <button
                        key={h}
                        onClick={() => setExpiryHours(String(h))}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
                          ${expiryHours === String(h)
                            ? 'bg-primary text-white'
                            : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                          }`}
                      >
                        {h < 24 ? `${h}h` : h < 168 ? `${h / 24}d` : '1w'}
                      </button>
                    ))}
                    <input
                      className="input-field w-20 text-center"
                      type="number"
                      min="1"
                      placeholder="hrs"
                      value={expiryHours}
                      onChange={e => setExpiryHours(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Max Decryptions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <Repeat size={14} className="text-text-secondary" />
                    Metered Access (Max Uses)
                  </label>
                  <Toggle enabled={enableMaxUses} onChange={setEnableMaxUses} />
                </div>
                {enableMaxUses && (
                  <div className="flex gap-2">
                    {[1, 5, 10, 50].map(n => (
                      <button
                        key={n}
                        onClick={() => setMaxDecryptions(String(n))}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
                          ${maxDecryptions === String(n)
                            ? 'bg-primary text-white'
                            : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                          }`}
                      >
                        {n}×
                      </button>
                    ))}
                    <input
                      className="input-field w-20 text-center"
                      type="number"
                      min="1"
                      placeholder="uses"
                      value={maxDecryptions}
                      onChange={e => setMaxDecryptions(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="glass p-5 space-y-3">
                {Object.entries(STEPS).map(([key, info]) => {
                  const isActive = step === key
                  const isDone = completedSteps.includes(key)
                  return (
                    <div key={key} className={`flex items-center gap-3 transition-all duration-300
                      ${isActive ? 'opacity-100' : isDone ? 'opacity-70' : 'opacity-30'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        ${isDone ? 'bg-green-500/20 border border-green-500/30 text-green-400' :
                          isActive ? 'bg-primary/20 border border-primary/30 text-primary' :
                          'bg-surface border border-border text-text-secondary'}`}
                      >
                        {isDone ? <CheckCircle size={14} /> : isActive ? <LoadingSpinner size={14} /> : info.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{info.label}</p>
                        <p className="text-xs text-text-secondary">{info.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Error */}
            {step === 'error' && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-red-400 mb-0.5">Upload Failed</p>
                  <p className="text-xs text-text-secondary">{error}</p>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !title.trim() || isUploading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
            >
              {isUploading ? (
                <>
                  <LoadingSpinner size={18} />
                  Processing...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Encrypt & Publish
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-11 h-6 rounded-full border transition-all duration-200 relative
        ${enabled ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200
        ${enabled ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}

function SuccessView({ result, onReset }: { result: { assetId: string; cid: string }; onReset: () => void }) {
  return (
    <div className="glass p-8 text-center animate-scaleIn">
      <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-green-400" />
      </div>
      <h2 className="text-xl font-extrabold mb-2">File Published!</h2>
      <p className="text-text-secondary text-sm mb-6">
        Your file is encrypted and listed on the marketplace. The decryption key is secured by Arcium MPC.
      </p>

      <div className="bg-surface rounded-xl p-4 text-left mb-6 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Asset ID</span>
          <span className="text-xs font-mono text-text-primary">{result.assetId.slice(0, 16)}...</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">IPFS CID</span>
          <span className="text-xs font-mono text-accent truncate ml-4 max-w-[160px]">{result.cid.slice(0, 20)}...</span>
        </div>
      </div>

      <div className="flex gap-3">
        <a href={`/asset/${result.assetId}`} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <ExternalLink size={15} />
          View Asset
        </a>
        <button onClick={onReset} className="btn-ghost flex-1">
          Upload Another
        </button>
      </div>
    </div>
  )
}
