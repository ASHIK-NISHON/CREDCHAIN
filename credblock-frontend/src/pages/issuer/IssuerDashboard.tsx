import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { motion } from 'framer-motion'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import AppNav from '../../components/layout/AppNav'
import WalletConnect from '../../components/wallet/WalletConnect'
import { issueCredential, IssueCredentialParams } from '../../lib/api/credentials'
import { checkIssuer, IssuerProfile } from '../../lib/api/issuers'
import { getPendingTransfers, getRejectedCredentials } from '../../lib/api/verification'
import { getAlgodConfigFromViteEnvironment } from '../../utils/network/getAlgoClientConfigs'
import ProgressTimeline from '../../components/credential/ProgressTimeline'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Spinner } from '../../components/ui/spinner'
import { Textarea } from '../../components/ui/textarea'

export default function IssuerDashboardPage() {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [result, setResult] = useState<{ assetId: string; txId: string } | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)
  const [issuerStatus, setIssuerStatus] = useState<{ isIssuer: boolean; isVerified: boolean; profile: IssuerProfile | null }>({
    isIssuer: false,
    isVerified: false,
    profile: null,
  })

  const [formData, setFormData] = useState<IssueCredentialParams>({
    issuerAddress: activeAddress || '',
    studentAddress: '',
    studentName: '',
    title: '',
    description: '',
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    certificateFile: '',
    certificateFileName: '',
  })

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
          try {
            profile = await import('../../lib/api/issuers').then((m) => m.getIssuerProfile(activeAddress))
          } catch {}
        }
        setIssuerStatus({ isIssuer: check.isIssuer, isVerified: check.isVerified, profile })
      } catch (err) {
        console.error('Failed to check issuer status:', err)
        setIssuerStatus({ isIssuer: false, isVerified: false, profile: null })
      }
    }

    checkStatus()
  }, [activeAddress])

  useEffect(() => {
    if (activeAddress) {
      setFormData((prev) => ({ ...prev, issuerAddress: activeAddress }))
    }
  }, [activeAddress])

  useEffect(() => {
    if (!activeAddress) return

    const loadCounts = async () => {
      try {
        const pending = await getPendingTransfers(activeAddress)
        setPendingCount(pending.length)

        const rejected = await getRejectedCredentials(activeAddress)
        setRejectedCount(rejected.filter((c) => !c.burned).length)
      } catch (e) {
        console.error('Failed to load counts:', e)
      }
    }

    loadCounts()
    const interval = setInterval(loadCounts, 30000)
    return () => clearInterval(interval)
  }, [activeAddress])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setFormData({
          ...formData,
          certificateFile: base64.split(',')[1] || base64,
          certificateFileName: file.name,
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' })
      return
    }

    if (!issuerStatus.isVerified) {
      enqueueSnackbar('Your issuer account is not verified. Please complete verification.', { variant: 'warning' })
      return
    }

    setLoading(true)
    setProgress([])
    setShowSuccess(false)

    try {
      if (!transactionSigner) {
        enqueueSnackbar('Wallet not ready. Please reconnect your wallet.', { variant: 'error' })
        return
      }

      const submitData = {
        ...formData,
        issuerAddress: activeAddress,
      }

      const result = await issueCredential(submitData, transactionSigner)
      setProgress(result.progress)
      setResult({
        assetId: result.assetId,
        txId: result.transactionHash,
      })
      setShowSuccess(true)
      enqueueSnackbar('Credential issued successfully!', { variant: 'success' })
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; response?: { data?: { error?: string } } }
      const isNetworkError = err.message === 'Network Error' || err.code === 'ERR_NETWORK'
      const message = isNetworkError
        ? 'Cannot reach backend. Is the CredChain backend running at http://localhost:3001?'
        : err.response?.data?.error || err.message || 'Failed to issue credential'
      enqueueSnackbar(message, { variant: 'error' })
      setProgress([`Error: ${isNetworkError ? message : String(err.message)}`])
    } finally {
      setLoading(false)
    }
  }

  const network = import.meta.env.VITE_ALGOD_NETWORK || 'testnet'
  const explorerUrl = import.meta.env.VITE_ALGORAND_EXPLORER || (network === 'localnet' ? null : 'https://testnet.explorer.perawallet.app')

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <div className="container mx-auto px-4 py-8">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-bold mb-8">
          Issuer Dashboard
        </motion.h1>

        {!activeAddress ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <Card className="mx-auto max-w-xl">
              <CardHeader>
                <CardTitle className="font-display">Connect wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">Please connect your wallet to issue credentials.</p>
                <WalletConnect
                  required
                  onRoleDetected={(isIssuer, isVerified) => {
                    if (isVerified) {
                      enqueueSnackbar('Issuer logged in!', { variant: 'success' })
                    } else if (isIssuer) {
                      enqueueSnackbar('Logged in. Complete verification to issue credentials.', { variant: 'info' })
                    }
                  }}
                />
              </CardContent>
            </Card>
          </motion.div>
        ) : !issuerStatus.isVerified ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <Card className="mx-auto max-w-xl border-yellow-500/20 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="font-display text-yellow-500">Verification Required</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">You need to verify your issuer account before you can issue credentials.</p>
                <Button asChild className="w-full">
                  <Link to="/register-issuer">Verify Issuer Account</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-4 gap-6">
            {/* Stats Cards */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                <Link to="/issuer/pending" className="text-3xl font-bold text-amber-600 hover:underline">
                  {pendingCount}
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Declined</CardTitle>
              </CardHeader>
              <CardContent>
                <Link to="/issuer/declined" className="text-3xl font-bold text-red-600 hover:underline">
                  {rejectedCount}
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Issued</CardTitle>
              </CardHeader>
              <CardContent>
                <Link to="/issuer/history" className="text-3xl font-bold text-primary hover:underline">
                  {issuerStatus.profile?.credentialCount || 0}
                </Link>
              </CardContent>
            </Card>

            {/* Issue New Credential - Link to Issue Page */}
            <div className="md:col-span-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="text-center py-8">
                  <CardTitle className="font-display text-2xl">Issue New Credential</CardTitle>
                  <p className="text-muted-foreground mt-2">
                    Click below to go to the issue page and create a new credential for a student.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 pb-8">
                  <Button asChild size="lg" className="text-lg px-8">
                    <Link to="/issuer/issue">Go to Issue Page →</Link>
                  </Button>
                  {activeAddress && (
                    <div className="text-center">
                      <p className="text-sm text-amber-600 mb-2">💰 Need Testnet ALGO?</p>
                      <a
                        href="https://lora.algokit.io/testnet/fund"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Fund your wallet with Testnet ALGO →
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <Dialog open={showSuccess && Boolean(result)} onOpenChange={(open) => setShowSuccess(open)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Credential Issued Successfully</DialogTitle>
            </DialogHeader>
            {result && (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  The credential has been minted and transferred to the student in a single transaction.
                </p>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Asset ID</p>
                  <p className="font-mono font-medium">{result.assetId}</p>
                </div>
                {explorerUrl && (
                  <a
                    href={`${explorerUrl}/asset/${result.assetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-medium text-primary hover:underline"
                  >
                    View on Explorer →
                  </a>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowSuccess(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
