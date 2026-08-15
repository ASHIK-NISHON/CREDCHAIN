import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { motion } from 'framer-motion'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import AppNav from '../../components/layout/AppNav'
import WalletConnect from '../../components/wallet/WalletConnect'
import { getCredentialsForStudent, rejectCredential } from '../../lib/api/verification'
import { getAlgodConfigFromViteEnvironment } from '../../utils/network/getAlgoClientConfigs'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Spinner } from '../../components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Label } from '../../components/ui/label'

interface Credential {
  assetId: string
  title: string
  studentName: string
  studentAddress?: string
  issueDate: string
  issuerAddress: string
}

const REJECT_REASONS = [
  'This credential is not for me',
  "I don't need this credential",
  'The information is incorrect',
  'I already have this credential',
  'Other',
]

export default function StudentClaimsPage() {
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; credential: Credential | null }>({
    open: false,
    credential: null,
  })
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [rejecting, setRejecting] = useState(false)

  const loadCredentials = async () => {
    if (!activeAddress) return

    setLoading(true)
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig })

      const accountInfo = await algorand.client.algod.accountInformation(activeAddress).do()
      const assets = accountInfo.assets || []

      const ownedIds = new Set(
        assets
          .filter((a) => Number(a.amount ?? 0) > 0)
          .map((a) => String(a.assetId ?? (a as { 'asset-id'?: number })['asset-id'] ?? ''))
          .filter(Boolean),
      )

      const issuedToMe = await getCredentialsForStudent(activeAddress)
      const toClaimList = issuedToMe.filter((c) => !c.rejected && !ownedIds.has(c.assetId))

      setCredentials(toClaimList)
    } catch (error) {
      console.error('Failed to load credentials:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeAddress) {
      loadCredentials()
    }
  }, [activeAddress])

  const handleRejectClick = (credential: Credential) => {
    setRejectDialog({ open: true, credential })
    setSelectedReason('')
  }

  const handleRejectConfirm = async () => {
    if (!rejectDialog.credential || !activeAddress || !selectedReason) return

    setRejecting(true)
    try {
      await rejectCredential(rejectDialog.credential.assetId, activeAddress, selectedReason)
      enqueueSnackbar('Credential rejected. The issuer has been notified.', { variant: 'info' })
      setRejectDialog({ open: false, credential: null })
      loadCredentials()
    } catch (error: any) {
      console.error('Error rejecting credential:', error)
      enqueueSnackbar(`Failed to reject: ${error.message || 'Unknown error'}`, { variant: 'error' })
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <div className="container mx-auto px-4 py-8">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-bold mb-8">
          Credentials to Claim
        </motion.h1>

        {!activeAddress ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <Card className="mx-auto max-w-xl">
              <CardHeader>
                <CardTitle className="font-display">Connect wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">Connect your wallet to view credentials to claim.</p>
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
                <CardTitle className="font-display">No credentials to claim</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 text-5xl opacity-70">✅</div>
                <p className="text-muted-foreground">You have no pending credentials to claim.</p>
                <div className="mt-6 flex justify-center gap-4">
                  <Button asChild variant="outline">
                    <Link to="/student/credentials">My Credentials</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/student/dashboard">Back to Dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-muted-foreground">
                You have {credentials.length} credential{credentials.length !== 1 ? 's' : ''} to claim
              </p>
              <Button asChild variant="outline">
                <Link to="/student/dashboard">Back to Dashboard</Link>
              </Button>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {credentials.map((c) => (
                    <div
                      key={c.assetId}
                      className="flex flex-col justify-between gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center"
                    >
                      <Link to={`/claim/${c.assetId}`} className="flex-1">
                        <div>
                          <p className="font-medium">{c.title}</p>
                          <p className="text-sm text-muted-foreground">Issued to {c.studentName}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">Asset ID: {c.assetId}</p>
                        </div>
                      </Link>
                      <div className="flex gap-2 shrink-0">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/claim/${c.assetId}`}>Claim Credential</Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleRejectClick(c)}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, credential: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Credential</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this credential? The issuer will be notified that you have declined it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium mb-3">Select a reason:</p>
            <div className="space-y-2">
              {REJECT_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rejectReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="w-4 h-4 text-destructive"
                  />
                  <span className="text-sm">{reason}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, credential: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirm} disabled={!selectedReason || rejecting}>
              {rejecting ? <Spinner className="h-4 w-4" /> : 'Reject Credential'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
