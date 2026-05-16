'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { ChevronDown, Shield, Zap } from 'lucide-react'
import Link from 'next/link'
import { requestAirdrop } from '@/lib/solana'

export function Header() {
  const { publicKey, connected, connecting, disconnect, select, connect, wallets, wallet } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)
  const [airdropping, setAirdropping] = useState(false)
  const [airdropMsg, setAirdropMsg] = useState('')
  const [walletError, setWalletError] = useState('')
  const [connectRequested, setConnectRequested] = useState(false)

  const fetchBalance = async () => {
    if (!publicKey) return
    try {
      const bal = await connection.getBalance(publicKey)
      setBalance(bal / LAMPORTS_PER_SOL)
    } catch {}
  }

  useEffect(() => {
    fetchBalance()
    if (!publicKey) return
    const id = setInterval(fetchBalance, 8000)
    return () => clearInterval(id)
  }, [publicKey, connection])

  useEffect(() => {
    if (!connectRequested || connected || connecting || !wallet) return

    connect()
      .catch((err: any) => setWalletError(err?.message ?? 'Wallet connection failed'))
      .finally(() => setConnectRequested(false))
  }, [connectRequested, connected, connecting, wallet, connect])

  const handleAirdrop = async () => {
    if (!publicKey) return
    setAirdropping(true)
    setAirdropMsg('')
    try {
      await requestAirdrop(connection, publicKey)
      await fetchBalance()
      setAirdropMsg('✓ 2 SOL airdropped!')
    } catch (e) {
      setAirdropMsg('Airdrop failed — try again')
    } finally {
      setAirdropping(false)
      setTimeout(() => setAirdropMsg(''), 3000)
    }
  }

  const handleWalletClick = async () => {
    setWalletError('')

    if (connected) {
      await disconnect()
      setConnectRequested(false)
      return
    }

    const phantom = wallets.find(w => w.adapter.name.toLowerCase().includes('phantom'))
    if (!phantom) {
      setWalletError('Install or unlock Phantom')
      return
    }

    try {
      select(phantom.adapter.name)
      setConnectRequested(true)
    } catch (err: any) {
      setWalletError(err?.message ?? 'Wallet connection failed')
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass-strong">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Shield size={16} className="text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:block">
            Cipher<span className="text-primary">Gate</span>
          </span>
        </Link>

        {/* Network badge */}
        <div className="badge-devnet hidden sm:flex">
          <span className="glow-dot"></span>
          Devnet
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {connected && (
            <div className="flex items-center gap-2">
              {/* Balance */}
              {balance !== null && (
                <span className="text-xs font-mono text-text-secondary hidden sm:block">
                  {balance.toFixed(3)} SOL
                </span>
              )}

              {/* Airdrop button */}
              <button
                onClick={handleAirdrop}
                disabled={airdropping}
                title="Request 2 SOL airdrop"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20
                           transition-all duration-200 disabled:opacity-50"
              >
                <Zap size={12} />
                <span className="hidden sm:block">{airdropping ? 'Airdropping...' : 'Airdrop'}</span>
              </button>

              {airdropMsg && (
                <span className="text-xs text-accent animate-fadeInUp">{airdropMsg}</span>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={handleWalletClick}
              disabled={connecting}
              className="h-[38px] px-4 rounded-xl bg-primary/15 border border-primary/30 text-sm font-semibold text-text-primary hover:bg-primary/25 transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {connecting || connectRequested
                ? 'Connecting...'
                : connected && publicKey
                  ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
                  : 'Connect Wallet'}
              {connected && <ChevronDown size={13} className="text-text-secondary" />}
            </button>
            {walletError && (
              <div className="absolute right-0 top-11 w-48 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {walletError}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
