import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { motion, AnimatePresence } from 'framer-motion'
import AppNav from '../components/layout/AppNav'
import WalletConnect from '../components/wallet/WalletConnect'
import CredentialCard from '../components/credential/CredentialCard'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { getCredentialsByAssetIds, getCredentialsForStudent, rejectCredential } from '../lib/api/verification'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Spinner } from '../components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Label } from '../components/ui/label'

interface Credential {
  assetId: string
  title: string
  studentName: string
  studentAddress?: string
  issueDate: string
  issuerAddress: string
  rejected?: boolean
  rejectedAt?: string
  rejectReason?: string
}

const REJECT_REASONS = [
  'This credential is not for me',
  "I don't need this credential",
  'The information is incorrect',
  'I already have this credential',
  'Other',
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const cardItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export default function StudentDashboard() {
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [toClaim, setToClaim] = useState<Credential[]>([])
  const [rejectedCredentials, setRejectedCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; credential: Credential | null }>({
    open: false,
    credential: null,
  })
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => {
    if (activeAddress) {
      loadCredentials()
    }
  }, [activeAddress])

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

      const ownedIds = new Set(assetIds)

      let credentialList: Credential[] = []
      if (assetIds.length > 0) {
        const dbCreds = await getCredentialsByAssetIds(assetIds)
        const credMap = new Map(dbCreds.map((c) => [c.assetId, c]))
        credentialList = assetIds.map((id) => {
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
      }

      let toClaimList: Credential[] = []
      let rejectedList: Credential[] = []
      try {
        const issuedToMe = await getCredentialsForStudent(activeAddress)
        toClaimList = issuedToMe.filter((c) => !c.rejected && !ownedIds.has(c.assetId))
        rejectedList = issuedToMe.filter((c) => c.rejected)
      } catch (e) {
        console.error('Failed to load credentials to claim:', e)
      }

      setToClaim(toClaimList)
      setRejectedCredentials(rejectedList)
      setCredentials(credentialList)
    } catch (error) {
      console.error('Failed to load owned credentials (Algod):', error)
      try {
        const issuedToMe = await getCredentialsForStudent(activeAddress)
        setToClaim(issuedToMe.filter((c) => !c.rejected))
        setRejectedCredentials(issuedToMe.filter((c) => c.rejected))
        setCredentials([])
      } catch (e) {
        console.error('Failed to load credentials from backend:', e)
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshCredentials = () => {
    setTimeout(() => {
      if (activeAddress) {
        loadCredentials()
      }
    }, 500)
  }

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
      refreshCredentials()
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
        ) : credentials.length === 0 && toClaim.length === 0 && rejectedCredentials.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <Card className="mx-auto max-w-2xl">
              <CardHeader>
                <CardTitle className="font-display">No credentials yet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 text-5xl opacity-70">📜</div>
                <p className="text-muted-foreground">
                  Credentials minted to your wallet will appear here. If an issuer sent you a credential, ask them for the claim link.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-10">
            {toClaim.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-xl">Credentials to Claim</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                      These credentials were issued to you. Click "Claim" to receive them in your wallet, or "Reject" to decline.
                    </p>
                    <div className="space-y-3">
                      {toClaim.map((c) => (
                        <div
                          key={c.assetId}
                          className="flex flex-col justify-between gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center"
                        >
                          <div>
                            <p className="font-medium">{c.title}</p>
                            <p className="text-sm text-muted-foreground">Issued to {c.studentName}</p>
                          </div>
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
              </motion.div>
            )}

            {rejectedCredentials.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="">
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardHeader>
                    <CardTitle className="font-display text-xl text-red-600">Rejected Credentials</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                      These credentials were rejected and will not be transferred to you.
                    </p>
                    <div className="space-y-3">
                      {rejectedCredentials.map((c) => (
                        <div
                          key={c.assetId}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4"
                        >
                          <div>
                            <p className="font-medium">{c.title}</p>
                            <p className="text-sm text-muted-foreground">Issued to {c.studentName}</p>
                            {c.rejectedAt && (
                              <p className="text-xs text-red-500 mt-1">Rejected on {new Date(c.rejectedAt).toLocaleDateString()}</p>
                            )}
                            {c.rejectReason && <p className="text-xs text-red-600 mt-1">Reason: {c.rejectReason}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {credentials.length > 0 && (
              <motion.div variants={container} initial="hidden" animate="show">
                <h2 className="font-display text-xl font-semibold mb-4">My Credentials</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {credentials.map((credential) => (
                      <motion.div key={credential.assetId} variants={cardItem}>
                        <CredentialCard {...credential} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
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
