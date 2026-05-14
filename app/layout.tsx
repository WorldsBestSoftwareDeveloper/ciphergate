import type { Metadata, Viewport } from 'next'
import './globals.css'
import { WalletContextProvider } from '@/components/WalletProvider'
import { BottomNav } from '@/components/BottomNav'
import { Toaster } from '@/components/Toaster'

export const metadata: Metadata = {
  title: 'CipherGate — Private Data Transfer',
  description: 'Encrypted file access powered by Arcium MPC on Solana',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-bg text-text-primary font-sans antialiased">
        <WalletContextProvider>
          <div className="min-h-screen pb-20 md:pb-0">
            {children}
          </div>
          <BottomNav />
          <Toaster />
        </WalletContextProvider>
      </body>
    </html>
  )
}
