import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Separator } from '../ui/separator'
import { checkIssuer } from '../../lib/api/issuers'

interface WalletConnectProps {
  required?: boolean
  onConnect?: () => void
  onRoleDetected?: (isIssuer: boolean, isVerified: boolean) => void
}

export default function WalletConnect({ required = false, onConnect, onRoleDetected }: WalletConnectProps) {
  const { activeAddress, wallets, isReady, activeWallet } = useWallet()
  const [showModal, setShowModal] = useState(false)
  const [hasShownToast, setHasShownToast] = useState(false)

  useEffect(() => {
    if (!activeAddress || hasShownToast) return

    const detectRole = async () => {
      try {
        const result = await checkIssuer(activeAddress)
        onRoleDetected?.(result.isIssuer, result.isVerified)
        setHasShownToast(true)
      } catch (err) {
        console.error('Failed to check issuer status:', err)
        onRoleDetected?.(false, false)
        setHasShownToast(true)
      }
    }

    detectRole()
  }, [activeAddress, hasShownToast, onRoleDetected])

  useEffect(() => {
    if (!activeAddress) {
      setHasShownToast(false)
    }
  }, [activeAddress])

  const handleConnect = async (walletId: string) => {
    try {
      const wallet = wallets.find((w) => w.id === walletId)
      if (wallet) {
        await wallet.connect()
        setShowModal(false)
        setHasShownToast(false)
        onConnect?.()
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('modal is closed by user') || message.includes('closed by user')) {
        setShowModal(false)
        return
      }
    }
  }

  const handleDisconnect = async () => {
    try {
      const activeWallet = wallets.find((w) => w.isActive)
      if (activeWallet) {
        await activeWallet.disconnect()
      }
    } catch {
      // Silently ignore disconnect errors
    }
  }

  if (activeAddress) {
    return (
      <div className="flex items-center gap-3">
        <motion.span
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-sm font-medium text-white"
        >
          {activeAddress.substring(0, 6)}...{activeAddress.substring(activeAddress.length - 4)}
        </motion.span>
        <Button onClick={handleDisconnect} size="sm" className="bg-white text-black hover:bg-white/90">
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button onClick={() => setShowModal(true)} disabled={!isReady} variant={required ? 'default' : 'outline'}>
        Connect Wallet
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Connect Wallet</DialogTitle>
            <DialogDescription>Select a wallet provider to continue.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {wallets.map((wallet) => {
              return (
                <Button
                  key={wallet.id}
                  onClick={() => handleConnect(wallet.id)}
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-3"
                  disabled={!wallet.metadata}
                >
                  {wallet.metadata?.icon && <img src={wallet.metadata.icon} alt={wallet.metadata.name} className="h-8 w-8 rounded-lg" />}
                  <span className="font-medium">{wallet.metadata?.name || wallet.id}</span>
                </Button>
              )
            })}
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
