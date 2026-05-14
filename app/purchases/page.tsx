'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Header } from '@/components/Header'
import { SkeletonCard } from '@/components/LoadingStates'
import { Asset, AccessRecord } from '@/lib/types'
import { getPurchasedAssets, isAccessValid } from '@/lib/store'
import { lamportsToSol, truncateAddress, formatExpiry } from '@/lib/utils'
import { ShoppingBag, Clock, Repeat, CheckCircle, XCircle, Lock } from 'lucide-react'
import Link from 'next/link'

interface PurchasedItem {
  record: AccessRecord
  asset: Asset
}

export default function PurchasesPage() {
  const { publicKey, connected } = useWallet()
  const [items, setItems] = useState<PurchasedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      if (publicKey) {
        setItems(getPurchasedAssets(publicKey.toBase58()))
      }
      setLoading(false)
    }, 400)
    return () => clearTimeout(t)
  }, [publicKey])

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShoppingBag size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">My Purchases</h1>
            <p className="text-xs text-text-secondary">Files you&apos;ve unlocked</p>
          </div>
        </div>

        {!connected ? (
          <div className="glass p-8 text-center">
            <Lock size={32} className="text-primary/30 mx-auto mb-3" />
            <p className="font-bold mb-1">Connect Wallet</p>
            <p className="text-text-secondary text-sm">Connect your wallet to see your purchased files.</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="glass p-8 text-center">
            <ShoppingBag size={32} className="text-primary/30 mx-auto mb-3" />
            <p className="font-bold mb-1">No purchases yet</p>
            <p className="text-text-secondary text-sm mb-5">
              Browse the marketplace to unlock encrypted files.
            </p>
            <Link href="/" className="btn-primary inline-flex items-center gap-2">
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(({ record, asset }, i) => {
              const validity = isAccessValid(record, asset)
              const usesLeft = asset.policy.maxDecryptions
                ? asset.policy.maxDecryptions - record.uses
                : null
              const expiresIn = record.expiry < 9999999999999
                ? Math.max(0, Math.floor((record.expiry - Date.now()) / (1000 * 60 * 60)))
                : null

              return (
                <Link key={record.id} href={`/asset/${asset.id}`}>
                  <div
                    className="card hover:border-primary/20 animate-fadeInUp"
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Lock size={16} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-base truncate">{asset.title}</h3>
                          <p className="text-xs text-text-secondary font-mono mt-0.5">
                            {truncateAddress(asset.owner)}
                          </p>
                        </div>
                      </div>

                      {/* Valid badge */}
                      <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border
                        ${validity.valid
                          ? 'bg-green-500/10 border-green-500/20 text-green-400'
                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}
                      >
                        {validity.valid
                          ? <><CheckCircle size={11} /> Active</>
                          : <><XCircle size={11} /> Expired</>
                        }
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-4 mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Repeat size={11} />
                        {usesLeft !== null
                          ? <span><span className="text-text-primary font-semibold">{usesLeft}</span> uses left</span>
                          : <span className="text-text-primary font-semibold">Unlimited</span>
                        }
                      </div>

                      {expiresIn !== null && (
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <Clock size={11} />
                          {expiresIn > 0
                            ? <span><span className="text-text-primary font-semibold">{formatExpiry(expiresIn)}</span> left</span>
                            : <span className="text-red-400 font-semibold">Expired</span>
                          }
                        </div>
                      )}

                      <div className="ml-auto text-xs font-mono text-text-secondary">
                        {lamportsToSol(asset.price)} SOL paid
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
