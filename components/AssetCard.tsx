'use client'

import Link from 'next/link'
import { Lock, Clock, Repeat, User } from 'lucide-react'
import { Asset } from '@/lib/types'
import { lamportsToSol, truncateAddress, formatExpiry } from '@/lib/utils'

interface AssetCardProps {
  asset: Asset
}

export function AssetCard({ asset }: AssetCardProps) {
  const fileTypeColor = {
    pdf: 'text-red-300',
    image: 'text-sky-300',
    video: 'text-violet-300',
    audio: 'text-emerald-300',
    zip: 'text-amber-300',
    other: 'text-text-secondary',
  }[asset.fileType ?? 'other'] ?? 'text-text-secondary'

  return (
    <Link href={`/asset/${asset.id}`}>
      <div className="card group cursor-pointer hover:-translate-y-0.5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-white/[0.06] border border-white/[0.10] flex items-center justify-center">
            <Lock size={18} className="text-primary/90" />
          </div>
          <span className={`text-xs font-mono uppercase font-bold ${fileTypeColor}`}>
            {asset.fileType ?? 'FILE'}
          </span>
        </div>

        <h3 className="font-bold text-base mb-1 line-clamp-2 text-text-primary group-hover:text-primary transition-colors">
          {asset.title}
        </h3>

        <div className="flex items-center gap-1.5 mb-4">
          <User size={11} className="text-text-secondary" />
          <span className="text-xs text-text-secondary font-mono">
            {truncateAddress(asset.owner)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {asset.policy.expiryHours && (
            <span className="flex items-center gap-1 text-[10px] bg-white/[0.04] border border-white/[0.10] px-2 py-0.5 rounded-full text-text-secondary">
              <Clock size={9} />
              {formatExpiry(asset.policy.expiryHours)}
            </span>
          )}
          {asset.policy.maxDecryptions && (
            <span className="flex items-center gap-1 text-[10px] bg-white/[0.04] border border-white/[0.10] px-2 py-0.5 rounded-full text-text-secondary">
              <Repeat size={9} />
              {asset.policy.maxDecryptions}x uses
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-0.5">Price</p>
            <p className="text-xl font-bold text-text-primary">
              {lamportsToSol(asset.price)} <span className="text-sm font-semibold text-text-secondary">SOL</span>
            </p>
          </div>
          <div className="btn-primary text-sm py-2 px-4">
            Unlock
          </div>
        </div>
      </div>
    </Link>
  )
}
