import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar, SnackbarKey } from 'notistack'
import { motion, AnimatePresence } from 'framer-motion'
import AppNav from '../../components/layout/AppNav'
import WalletConnect from '../../components/wallet/WalletConnect'
import { checkIssuer, IssuerProfile } from '../../lib/api/issuers'
import { getRejectedCredentials, burnCredential, RejectedCredential } from '../../lib/api/verification'
import { burnAsset } from '../../lib/algorand/nft'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Spinner } from '../../components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'

export default function IssuerDeclinedPage() {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar, closeSnackbar } = useSnackbar()
  const [rejected, setRejected] = useState<RejectedCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [issuerStatus, setIssuerStatus] = useState<{ isIssuer: boolean; isVerified: boolean; profile: IssuerProfile | null }>({
    isIssuer: false,
    isVerified: false,
    profile: null,
  })

  const [burnDialog, setBurnDialog] = useState<{ open: boolean; credential: RejectedCredential | null }>({ open: false, credential: null })
  const [burning, setBurning] = useState<string | null>(null)
  const [burningCredentials, setBurningCredentials] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!activeAddress) {
      setIssuerStatus({ isIssuer: false, isVerified: false, profile: null })
      return
    }
    const checkStatus = async () => {
      try {
        const check = await checkIssuer(activeAddress)
        let profile: IssuerProfile | null = null
        if (check.isIssuer) {
          try { profile = await import('../../lib/api/issuers').then((m) => m.getIssuerProfile(activeAddress)) } catch { /* ignore */ }
        }
        setIssuerStatus({ isIssuer: check.isIssuer, isVerified: check.isVerified, profile })
      } catch { setIssuerStatus({ isIssuer: false, isVerified: false, profile: null }) }
    }
    checkStatus()
  }, [activeAddress])

  useEffect(() => {
    if (!activeAddress || !issuerStatus.isVerified) return
    const loadRejected = async () => {
      try {
        const data = await getRejectedCredentials(activeAddress)
        setRejected(data)
      } catch { /* ignore */ } finally { setLoading(false) }
    }
    loadRejected()
    const interval = setInterval(loadRejected, 30000)
    return () => clearInterval(interval)
  }, [activeAddress, issuerStatus.isVerified])

  const handleBurnClick = (credential: RejectedCredential) => setBurnDialog({ open: true, credential })

  const handleBurnConfirm = async () => {
    if (!burnDialog.credential || !activeAddress || !transactionSigner) { enqueueSnackbar('Please connect your wallet', { variant: 'warning' }); return }
    const assetIdToRemove = burnDialog.credential.assetId
    setBurning(burnDialog.credential.assetId)
    setBurnDialog({ open: false, credential: null })
    let waitingKey: SnackbarKey = 0
    let burningKey: SnackbarKey = 0
    try {
      waitingKey = enqueueSnackbar('📱 Please approve the burn transaction in your wallet', { variant: 'info', persist: true })
      await burnAsset(assetIdToRemove, activeAddress, transactionSigner)
      closeSnackbar(waitingKey)
      burningKey = enqueueSnackbar('Burning credential on blockchain...', { variant: 'info', persist: true })
      await burnCredential(assetIdToRemove, activeAddress)
      closeSnackbar(burningKey)
      setBurningCredentials((prev) => new Set(prev).add(assetIdToRemove))
      enqueueSnackbar('Credential burned successfully!', { variant: 'success' })
      // Reload to get updated burned status
      const data = await getRejectedCredentials(activeAddress)
      setRejected(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      enqueueSnackbar(`Failed to burn: ${message}`, { variant: 'error' })
    } finally { 
      setBurning(null)
      if (waitingKey) closeSnackbar(waitingKey)
      if (burningKey) closeSnackbar(burningKey)
    }
  }

  const rejectedList = rejected.filter((c) => !c.removedFromWallet && !c.burned)
  const removedList = rejected.filter((c) => c.removedFromWallet && !c.burned)
  const burnedList = rejected.filter((c) => c.burned)

  if (!activeAddress) return (
    <div className="min-h-screen bg-background"><AppNav />
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-xl"><CardHeader><CardTitle>Connect wallet</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-muted-foreground">Please connect your wallet to view declined credentials.</p><WalletConnect required /></CardContent></Card>
      </div>
    </div>
  )

  if (!issuerStatus.isVerified) return (
    <div className="min-h-screen bg-background"><AppNav />
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-xl border-yellow-500/20 bg-yellow-500/5"><CardHeader><CardTitle className="text-yellow-500">Verification Required</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-muted-foreground">You need to verify your issuer account.</p><Button asChild className="w-full"><Link to="/register-issuer">Verify Issuer Account</Link></Button></CardContent></Card>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen bg-background"><AppNav />
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center py-16">
        <Spinner className="h-6 w-6" /><p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <div className="container mx-auto px-4 py-8">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-bold mb-8">Declined Credentials</motion.h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Rejected</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{rejectedList.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Removed</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-orange-600">{removedList.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Burned</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-gray-500">{burnedList.length}</p></CardContent></Card>
        </div>

        {/* Rejected */}
        {rejectedList.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <h3 className="col-span-full text-lg font-semibold text-red-600">Rejected</h3>
            <AnimatePresence>
              {rejectedList.map((cred) => (
                <motion.div key={cred.id} initial={{ opacity: 1 }} animate={{ opacity: burningCredentials.has(cred.assetId) ? 0.5 : 1 }}>
                  <Card className="p-4 border-2 border-red-500/30 bg-red-500/5">
                    <CardHeader><div className="flex justify-between"><CardTitle className="text-lg">{cred.title}</CardTitle><span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-600">Rejected</span></div></CardHeader>
                    <CardContent>
                      <p className="text-sm">Student: {cred.studentName}</p>
                      <p className="text-xs font-mono mt-1">Asset ID: {cred.assetId}</p>
                      {cred.rejectedAt && <p className="text-xs text-red-500 mt-2">{new Date(cred.rejectedAt).toLocaleDateString()}</p>}
                    </CardContent>
                    <CardContent className="flex gap-2">
                      <Button asChild variant="outline" size="sm"><Link to={`/verify/${cred.assetId}`}>View</Link></Button>
                      <Button variant="default" size="sm" disabled={!!burning} onClick={() => handleBurnClick(cred)} className="bg-red-600">{burning === cred.assetId ? 'Burning...' : 'BURN'}</Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Removed */}
        {removedList.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <h3 className="col-span-full text-lg font-semibold text-orange-600">Removed from Wallet</h3>
            <AnimatePresence>
              {removedList.map((cred) => (
                <motion.div key={cred.id} initial={{ opacity: 1 }}>
                  <Card className="p-4 border-2 border-orange-500/30 bg-orange-500/5">
                    <CardHeader><div className="flex justify-between"><CardTitle className="text-lg">{cred.title}</CardTitle><span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-600">Removed</span></div></CardHeader>
                    <CardContent>
                      <p className="text-sm">Student: {cred.studentName}</p>
                      <p className="text-xs font-mono mt-1">Asset ID: {cred.assetId}</p>
                      {cred.removedFromWalletAt && <p className="text-xs text-orange-600 mt-2">{new Date(cred.removedFromWalletAt).toLocaleDateString()}</p>}
                    </CardContent>
                    <CardContent className="flex gap-2">
                      <Button asChild variant="outline" size="sm"><Link to={`/verify/${cred.assetId}`}>View</Link></Button>
                      <Button variant="default" size="sm" disabled={!!burning} onClick={() => handleBurnClick(cred)} className="bg-red-600">{burning === cred.assetId ? 'Burning...' : 'BURN'}</Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Burned */}
        {burnedList.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <h3 className="col-span-full text-lg font-semibold text-gray-500">Burned</h3>
            <AnimatePresence>
              {burnedList.map((cred) => (
                <motion.div key={cred.id} initial={{ opacity: 1 }}>
                  <Card className="p-4 border-2 border-gray-500/30 bg-gray-500/5">
                    <CardHeader><div className="flex justify-between"><CardTitle className="text-lg">{cred.title}</CardTitle><span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-600">Burned</span></div></CardHeader>
                    <CardContent>
                      <p className="text-sm">Student: {cred.studentName}</p>
                      <p className="text-xs font-mono mt-1">Asset ID: {cred.assetId}</p>
                      {cred.burnedAt && <p className="text-xs text-gray-500 mt-2">{new Date(cred.burnedAt).toLocaleDateString()}</p>}
                    </CardContent>
                    <CardContent><Button asChild variant="outline" size="sm"><Link to={`/verify/${cred.assetId}`}>View</Link></Button></CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty */}
        {rejectedList.length === 0 && removedList.length === 0 && burnedList.length === 0 && (
          <div className="text-center py-12"><div className="text-5xl mb-4">👍</div><h3 className="text-lg font-semibold">No Declined Credentials</h3><p className="text-muted-foreground">When students decline or remove credentials, they appear here.</p></div>
        )}
      </div>

      <Dialog open={burnDialog.open} onOpenChange={(open) => setBurnDialog({ open, credential: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600">🔥 Burn Credential</DialogTitle><DialogDescription>This is irreversible!</DialogDescription></DialogHeader>
          <div className="py-4">
            <p className="mb-4">You are about to burn:</p>
            <div className="bg-muted p-4 rounded-lg mb-4"><p className="font-semibold">{burnDialog.credential?.title}</p><p className="text-sm">To: {burnDialog.credential?.studentName}</p></div>
            <div className="bg-red-500/10 p-4 rounded-lg"><p className="text-red-600 font-medium">This will permanently destroy the credential on Algorand blockchain.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBurnDialog({ open: false, credential: null })}>Cancel</Button>
            <Button variant="default" onClick={handleBurnConfirm} disabled={!!burning} className="bg-red-600">{burning ? 'Burning...' : 'Yes, Burn'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}