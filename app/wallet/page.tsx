'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { Header } from '@/components/Header'
import { LoadingSpinner } from '@/components/LoadingStates'
import { getBalance, requestAirdrop, explorerAddressLink } from '@/lib/solana'
import { getAssetsByOwner } from '@/lib/store'
import { lamportsToSol, truncateAddress } from '@/lib/utils'
import { Asset } from '@/lib/types'
import {
  Wallet, Copy, ExternalLink, Zap, CheckCircle,
  TrendingUp, Lock, RefreshCw
} from 'lucide-react'
import Link from 'next/link'

export default function WalletPage() {
  const { publicKey, connected, disconnect } = useWallet()
  const { connection } = useConnection()

  const [balance, setBalance] = useState<number | null>(null)
  const [airdropping, setAirdropping] = useState(false)
  const [airdropMsg, setAirdropMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [ownedAssets, setOwnedAssets] = useState<Asset[]>([])

  const fetchBalance = async () => {
    if (!publicKey) return
    const bal = await getBalance(connection, publicKey)
    setBalance(bal)
  }

  useEffect(() => {
    fetchBalance()
    if (!publicKey) return
    setOwnedAssets(getAssetsByOwner(publicKey.toBase58()))
    const interval = setInterval(fetchBalance, 10000)
    return () => clearInterval(interval)
  }, [publicKey, connection])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchBalance()
    setRefreshing(false)
  }

  const handleAirdrop = async () => {
    if (!publicKey) return
    setAirdropping(true)
    setAirdropMsg('')
    try {
      await requestAirdrop(connection, publicKey, 2)
      await fetchBalance()
      setAirdropMsg('2 SOL airdropped!')
    } catch {
      setAirdropMsg('Airdrop failed — try again')
    } finally {
      setAirdropping(false)
      setTimeout(() => setAirdropMsg(''), 4000)
    }
  }

  const copyAddress = () => {
    if (!publicKey) return
    navigator.clipboard.writeText(publicKey.toBase58())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-extrabold">Wallet</h1>

        {!connected ? (
          <div className="glass p-8 text-center">
            <Wallet size={32} className="text-primary/40 mx-auto mb-3" />
            <p className="font-bold mb-1">No Wallet Connected</p>
            <p className="text-text-secondary text-sm">Connect Phantom to view your wallet.</p>
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative">
                <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Balance · Devnet</p>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-4xl font-extrabold">
                    {balance !== null ? balance.toFixed(4) : '—'}
                  </span>
                  <span className="text-lg text-text-secondary mb-1">SOL</span>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="ml-auto text-text-secondary hover:text-text-primary transition-colors mb-1"
                  >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Address */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-secondary truncate">
                    {truncateAddress(publicKey!.toBase58(), 8)}
                  </span>
                  <button onClick={copyAddress} className="text-text-secondary hover:text-accent transition-colors shrink-0">
                    {copied ? <CheckCircle size={13} className="text-green-400" /> : <Copy size={13} />}
                  </button>
                  <a
                    href={explorerAddressLink(publicKey!.toBase58())}
                    target="_blank"
                    rel="noreferrer"
                    className="text-text-secondary hover:text-accent transition-colors shrink-0"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleAirdrop}
                disabled={airdropping}
                className="btn-accent flex items-center justify-center gap-2 py-3"
              >
                {airdropping ? <LoadingSpinner size={16} /> : <Zap size={16} />}
                {airdropping ? 'Airdropping...' : 'Get 2 SOL'}
              </button>

              <button
                onClick={() => disconnect()}
                className="btn-ghost flex items-center justify-center gap-2 py-3"
              >
                Disconnect
              </button>
            </div>

            {airdropMsg && (
              <p className={`text-center text-sm font-semibold ${airdropMsg.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                {airdropMsg}
              </p>
            )}

            {/* Network info */}
            <div className="glass p-4 space-y-3">
              <h3 className="font-bold text-sm">Network</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Network</span>
                <span className="badge-devnet"><span className="glow-dot" />Devnet</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">RPC</span>
                <span className="font-mono text-xs text-text-primary">api.devnet.solana.com</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">MPC Layer</span>
                <span className="badge-primary">Arcium</span>
              </div>
            </div>

            {/* Owned assets */}
            {ownedAssets.length > 0 && (
              <div className="glass p-5">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <TrendingUp size={15} className="text-primary" />
                  Your Listings ({ownedAssets.length})
                </h3>
                <div className="space-y-2">
                  {ownedAssets.map(asset => (
                    <Link key={asset.id} href={`/asset/${asset.id}`}>
                      <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border hover:border-primary/20 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <Lock size={13} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{asset.title}</p>
                          <p className="text-xs text-text-secondary font-mono">{lamportsToSol(asset.price)} SOL</p>
                        </div>
                        <ExternalLink size={13} className="text-text-secondary shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
