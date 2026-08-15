import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { motion } from 'framer-motion'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import AppNav from '../../components/layout/AppNav'
import WalletConnect from '../../components/wallet/WalletConnect'
import { getCredentialsByAssetIds, markCredentialRemoved, generateShareQR } from '../../lib/api/verification'
import { optOutOfAsset } from '../../lib/algorand/nft'
import { getAlgodConfigFromViteEnvironment } from '../../utils/network/getAlgoClientConfigs'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Spinner } from '../../components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import QRCodeModal from '../../components/ui/QRCodeModal'

interface Credential {
  assetId: string
  title: string
  studentName: string
  studentAddress?: string
  issueDate: string
  issuerAddress: string
}

export default function StudentCredentialsPage() {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [credentialToRemove, setCredentialToRemove] = useState<Credential | null>(null)
  const [sharing, setSharing] = useState<string | null>(null)
  const [showWalletPrompt, setShowWalletPrompt] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrData, setQrData] = useState('')

  const handleShare = async (credential: Credential) => {
    setSharing(credential.assetId)
    try {
      const result = await generateShareQR(credential.assetId)
      setQrData(result.qrCodeDataUrl)
      setShowQR(true)
    } catch {
      const url = `${window.location.origin}/verify/${credential.assetId}`
      try {
        await navigator.clipboard.writeText(url)
        enqueueSnackbar('Share link copied to clipboard!', { variant: 'success' })
      } catch {
        enqueueSnackbar('Failed to share', { variant: 'error' })
      }
      setSharing(null)
    }
  }

  const loadCredentials = async () => {
    if (!activeAddress) return

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig })

      const accountInfo = await algorand.client.algod.accountInformation(activeAddress).do()
      const assets = accountInfo.assets || []

      const assetIds = assets
        .filter((a) => Number(a.amount ?? 0) > 0)
        .map((a) => String(a.assetId ?? (a as { 'asset-id'?: number })['asset-id'] ?? ''))
        .filter(Boolean)

      if (assetIds.length === 0) {
        setCredentials([])
        setLoading(false)
        return
      }

      const dbCreds = await getCredentialsByAssetIds(assetIds)
      const credMap = new Map(dbCreds.map((c) => [c.assetId, c]))

      const credentialList = assetIds.map((id) => {
        const c = credMap.get(id)
        return c
          ? { ...c }
          : {
              assetId: id,
              title: `Credential #${id}`,
              studentName: 'Student',
              issueDate: new Date().toISOString(),
              issuerAddress: activeAddress,
            }
      })

      setCredentials(credentialList)
    } catch (error) {
      console.error('[StudentCredentials] Error loading credentials:', error)
      setCredentials([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeAddress) {
      loadCredentials()
    }
  }, [activeAddress])

  const handleRemoveClick = (credential: Credential) => {
    setCredentialToRemove(credential)
    setShowConfirmDialog(true)
  }

  const handleRemove = async () => {
    if (!credentialToRemove || !activeAddress || !transactionSigner) {
      setShowConfirmDialog(false)
      setCredentialToRemove(null)
      return
    }

    setShowConfirmDialog(false)
    setRemoving(credentialToRemove.assetId)
    setShowWalletPrompt(true)
    enqueueSnackbar('Please open your wallet and approve the transaction', { variant: 'info' })
    try {
      const receiver = credentialToRemove.issuerAddress || activeAddress
      await optOutOfAsset(credentialToRemove.assetId, activeAddress, transactionSigner, receiver)

      try {
        await markCredentialRemoved(credentialToRemove.assetId, activeAddress)
      } catch {}

      enqueueSnackbar('Credential removed from wallet', { variant: 'success' })
      setCredentials((prev) => prev.filter((c) => c.assetId !== credentialToRemove.assetId))
    } catch (error: any) {
      enqueueSnackbar(`Failed to remove: ${error.message || 'Unknown error'}`, { variant: 'error' })
    } finally {
      setRemoving(null)
      setShowWalletPrompt(false)
      setCredentialToRemove(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <div className="container mx-auto px-4 py-8">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-bold mb-8">
          My Credentials
        </motion.h1>

        {!activeAddress ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <Card className="mx-auto max-w-xl">
              <CardHeader>
                <CardTitle className="font-display">Connect wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">Connect your wallet to view your credentials.</p>
                <WalletConnect required />
              </CardContent>
            </Card>
          </motion.div>
        ) : loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16">
            <Spinner className="h-6 w-6 text-primary" />
            <p className="mt-4 text-muted-foreground">Loading credentials...</p>
          </motion.div>
        ) : credentials.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <Card className="mx-auto max-w-2xl">
              <CardHeader>
                <CardTitle className="font-display">No credentials yet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 text-5xl opacity-70">📜</div>
                <p className="text-muted-foreground">You don't have any credentials in your wallet yet.</p>
                <div className="mt-6 flex justify-center gap-4">
                  <Button asChild>
                    <Link to="/student/claims">Check Claims</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div>
            <div className="mb-6">
              <p className="text-lg">
                You own <span className="font-semibold text-foreground">{credentials.length}</span> credential{credentials.length !== 1 ? 's' : ''} in your wallet
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                💡 These credentials are stored as NFTs in your Algorand wallet. You can view them in the "NFTs" or "Assets" section of your wallet app.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/student/dashboard">Back to Dashboard</Link>
              </Button>
            </div>

            {showWalletPrompt && removing && (
              <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
                <Spinner className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-blue-600">Please open your wallet and approve the transaction</p>
                  <p className="text-sm text-muted-foreground">This may take a few moments...</p>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {credentials.map((credential) => (
                <Card key={credential.assetId} className="p-4 border-2">
                  <CardHeader>
                    <CardTitle className="font-display text-lg">{credential.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Issued to: {credential.studentName}</p>
                    <p className="text-sm text-muted-foreground">Date: {new Date(credential.issueDate).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-2">Asset ID: {credential.assetId}</p>
                  </CardContent>
                  <CardContent className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/verify/${credential.assetId}`}>View</Link>
                    </Button>
                    <Button variant="outline" size="sm" disabled={sharing === credential.assetId} onClick={() => handleShare(credential)}>
                      {sharing === credential.assetId ? 'Sharing...' : 'Share'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={removing === credential.assetId}
                      onClick={() => handleRemoveClick(credential)}
                    >
                      {removing === credential.assetId ? 'Removing...' : 'Remove'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Credential</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this credential from your wallet? This will opt out and transfer it back to the issuer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Yes, Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showQR && sharing && (
        <QRCodeModal
          qrData={qrData}
          verificationUrl={`${window.location.origin}/verify/${sharing}`}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  )
}
