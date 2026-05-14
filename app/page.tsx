'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { AssetCard } from '@/components/AssetCard'
import { SkeletonCard } from '@/components/LoadingStates'
import { Asset } from '@/lib/types'
import { getAllAssets } from '@/lib/store'
import { Shield, TrendingUp, Lock, Zap, Upload } from 'lucide-react'

export default function MarketplacePage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pdf' | 'image' | 'video' | 'other'>('all')

  useEffect(() => {
    const t = setTimeout(() => {
      setAssets(getAllAssets())
      setLoading(false)
    }, 600)
    return () => clearTimeout(t)
  }, [])

  const filtered = filter === 'all'
    ? assets
    : assets.filter(a => (a.fileType ?? 'other') === filter)

  const stats = [
    { label: 'Files Listed', value: assets.length, icon: Lock },
    { label: 'Network', value: 'Devnet', icon: Zap },
    { label: 'MPC Layer', value: 'Demo', icon: Shield },
    { label: 'Encryption', value: 'AES-256', icon: TrendingUp },
  ]

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="liquid-panel mb-5 p-5 md:p-6">
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="badge-devnet mb-4">
                <span className="glow-dot" />
                Devnet workspace
              </div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight">
                Encrypted asset desk
              </h1>
              <p className="mt-2 max-w-2xl text-sm md:text-base text-text-secondary leading-relaxed">
                Publish encrypted files, price access, and test policy-controlled decrypts before wiring the registry to the deployed program.
              </p>
            </div>
            <a href="/upload" className="btn-primary inline-flex items-center justify-center gap-2 md:self-center">
              <Upload size={16} />
              Upload
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="metric-panel">
              <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.10] flex items-center justify-center shrink-0">
                <Icon size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-text-secondary">{label}</p>
                <p className="text-base font-bold">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <span className="text-sm text-text-secondary shrink-0">Filter:</span>
          {(['all', 'pdf', 'image', 'video', 'other'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200
                ${filter === f
                  ? 'bg-white text-bg'
                  : 'bg-white/[0.04] border border-white/[0.10] text-text-secondary hover:text-text-primary'
                }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="liquid-panel text-center py-14 px-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-lg bg-white/[0.06] border border-white/[0.10] flex items-center justify-center mx-auto mb-4">
                <Lock size={24} className="text-primary/70" />
              </div>
              <h3 className="text-lg font-bold mb-2">No files listed</h3>
              <p className="text-text-secondary text-sm mb-6">
                Upload an encrypted test file to start validating the flow.
              </p>
              <a href="/upload" className="btn-primary inline-flex items-center gap-2">
                <Upload size={15} />
                Upload
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((asset, i) => (
              <div
                key={asset.id}
                className="animate-fadeInUp"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
              >
                <AssetCard asset={asset} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
