'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Shield, Zap } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { requestAirdrop } from '@/lib/solana'

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export function Header() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)
  const [airdropping, setAirdropping] = useState(false)
  const [airdropMsg, setAirdropMsg] = useState('')

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

          <WalletMultiButton
            style={{
              background: 'rgba(109, 93, 246, 0.15)',
              border: '1px solid rgba(109, 93, 246, 0.3)',
              borderRadius: '12px',
              fontFamily: 'Segoe UI, Inter, Arial, sans-serif',
              fontSize: '13px',
              fontWeight: '600',
              height: '38px',
              padding: '0 16px',
            }}
          />
        </div>
      </div>
    </header>
  )
}
