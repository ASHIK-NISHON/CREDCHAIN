import { useState, useEffect } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import AppNav from '../components/layout/AppNav'
import WalletConnect from '../components/wallet/WalletConnect'
import { issueCredential, IssueCredentialParams } from '../lib/api/credentials'
import { checkIssuer, IssuerProfile } from '../lib/api/issuers'
import { getPendingTransfers, completeTransfer, getRejectedCredentials } from '../lib/api/verification'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import ProgressTimeline from '../components/credential/ProgressTimeline'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Spinner } from '../components/ui/spinner'
import { Textarea } from '../components/ui/textarea'

export default function IssuerDashboard() {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [result, setResult] = useState<{ assetId: string; txId: string } | null>(null)
  const [pendingTransfers, setPendingTransfers] = useState<{id: string; assetId: string; studentAddress: string; studentName: string; title: string}[]>([])
  const [rejectedTransfers, setRejectedTransfers] = useState<{id: string; assetId: string; studentAddress: string; studentName: string; title: string; rejectedAt: string; rejectReason: string | null}[]>([])
  const [transferring, setTransferring] = useState<string | null>(null)
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
            profile = await import('../lib/api/issuers').then((m) => m.getIssuerProfile(activeAddress))
          } catch {
            // Profile not found, keep null
          }
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

  // Poll for pending transfers every 30 seconds
  useEffect(() => {
    if (!activeAddress) return

    const loadPending = async () => {
      try {
        const pending = await getPendingTransfers(activeAddress)
        setPendingTransfers(pending)

        const rejected = await getRejectedCredentials(activeAddress)
        setRejectedTransfers(rejected)
      } catch (e) {
        console.error('Failed to load pending/rejected transfers:', e)
      }
    }

    loadPending()
    const interval = setInterval(loadPending, 30000)
    return () => clearInterval(interval)
  }, [activeAddress])

  const handleTransferToStudent = async (assetId: string, studentAddress: string) => {
    if (!activeAddress || !transactionSigner) return

    setTransferring(assetId)
    try {
      const config = getAlgodConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig: config })

      algorand.setSigner(activeAddress, transactionSigner)

      const result = await algorand.send.assetTransfer({
        sender: activeAddress,
        receiver: studentAddress,
        assetId: BigInt(assetId),
        amount: 1n,
      })

      await new Promise((resolve) => setTimeout(resolve, 2000))

      const token = typeof config.token === 'string' ? config.token : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const algosdk = (await import('algosdk')).default
      const client = new algosdk.Algodv2(token, config.server, config.port || '443')

      const studentInfo = await client.accountInformation(studentAddress).do()
      const assets = studentInfo.assets || []
      const hasAsset = assets.some((a: any) => a['asset-id'] === parseInt(assetId) && a.amount > 0)

      if (!hasAsset) {
        enqueueSnackbar('Transfer submitted but asset not received. Check explorer.', { variant: 'warning' })
      }

      await completeTransfer(assetId, result.txIds[0] || '')

      enqueueSnackbar(hasAsset ? 'Credential transferred to student!' : 'Transfer completed (verification pending)', { variant: 'success' })

      setPendingTransfers((prev) => prev.filter((p) => p.assetId !== assetId))
    } catch (error: any) {
      enqueueSnackbar(`Failed to transfer: ${error.message || 'Unknown'}`, { variant: 'error' })
    } finally {
      setTransferring(null)
    }
  }

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

    if (!issuerStatus.isIssuer) {
      enqueueSnackbar('You are not registered as an issuer. Please register first.', { variant: 'warning' })
      navigate('/register-issuer')
      return
    }

    if (!issuerStatus.isVerified) {
      enqueueSnackbar('Your issuer account is not verified. Please complete verification.', { variant: 'warning' })
      navigate('/register-issuer')
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

  // Pera Explorer works for TestNet; no public explorer for LocalNet
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
                    } else {
                      enqueueSnackbar('Logged in as student', { variant: 'info' })
                    }
                  }}
                />
              </CardContent>
            </Card>
          </motion.div>
        ) : !issuerStatus.isIssuer || !issuerStatus.isVerified ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <Card className="mx-auto max-w-xl border-yellow-500/20 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="font-display text-yellow-500">Setup Required</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  {!issuerStatus.isIssuer
                    ? 'You need to register as an issuer before you can issue credentials.'
                    : 'Your issuer account is not verified. Complete verification to start issuing credentials.'}
                </p>
                <Button asChild className="w-full">
                  <Link to="/register-issuer">Register as Issuer</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-display text-2xl">Issue New Credential</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-1.5">
                        <Label>Certificate File</Label>
                        <Input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleFileChange}
                          className="h-11 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-primary file:font-medium"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Student Name</Label>
                        <Input
                          type="text"
                          value={formData.studentName}
                          onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                          placeholder="Full name"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Student Wallet Address</Label>
                        <Input
                          type="text"
                          value={formData.studentAddress}
                          onChange={(e) => setFormData({ ...formData, studentAddress: e.target.value })}
                          className="h-11 font-mono text-sm"
                          placeholder="Algorand address"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Credential Title</Label>
                        <Input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="e.g. Bachelor of Science"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="min-h-[100px] resize-y"
                          rows={3}
                          placeholder="Optional description"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Issue Date</Label>
                          <Input
                            type="date"
                            value={formData.issueDate}
                            onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Expiry Date (Optional)</Label>
                          <Input
                            type="date"
                            value={formData.expiryDate}
                            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                          />
                        </div>
                      </div>

                      <Button type="submit" disabled={loading} className="w-full">
                        {loading ? (
                          <>
                            <Spinner />
                            Minting…
                          </>
                        ) : (
                          'Mint Credential'
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>

              <AnimatePresence>
                {progress.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <ProgressTimeline steps={progress} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl">Issuer Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <span className="text-sm text-muted-foreground">Connected address</span>
                  <p className="rounded-lg border bg-muted/30 p-3 font-mono text-sm break-all">{activeAddress}</p>
                  {issuerStatus.profile?.name && (
                    <>
                      <span className="text-sm text-muted-foreground">Name</span>
                      <p className="rounded-lg border bg-muted/30 p-3 font-medium">{issuerStatus.profile.name}</p>
                    </>
                  )}
                  <span className="text-sm text-muted-foreground">Status</span>
                  <p className="rounded-lg border bg-emerald-500/10 p-3 font-medium text-emerald-500">✓ Verified Issuer</p>
                  {issuerStatus.profile?.credentialCount !== undefined && issuerStatus.profile.credentialCount > 0 && (
                    <>
                      <span className="text-sm text-muted-foreground">Credentials Issued</span>
                      <p className="rounded-lg border bg-muted/30 p-3 font-medium">{issuerStatus.profile.credentialCount}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Pending Transfers Section */}
            {pendingTransfers.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardHeader>
                    <CardTitle className="font-display text-xl text-amber-600">Pending Transfers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {pendingTransfers.map((cred) => (
                      <div key={cred.id} className="flex items-center justify-between border p-3 rounded-lg">
                        <div>
                          <p className="font-medium">{cred.title}</p>
                          <p className="text-sm text-muted-foreground">To: {cred.studentAddress.slice(0, 8)}...</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleTransferToStudent(cred.assetId, cred.studentAddress)}
                          disabled={transferring === cred.assetId}
                        >
                          {transferring === cred.assetId ? <Spinner className="h-4 w-4" /> : 'Transfer'}
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Rejected Credentials Section */}
            {rejectedTransfers.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardHeader>
                    <CardTitle className="font-display text-xl text-red-600">Declined Credentials</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {rejectedTransfers.map((cred) => (
                      <div key={cred.id} className="flex items-center justify-between border p-3 rounded-lg">
                        <div>
                          <p className="font-medium">{cred.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Student: {cred.studentAddress.slice(0, 8)}... | Declined:{' '}
                            {cred.rejectedAt ? new Date(cred.rejectedAt).toLocaleDateString() : 'Recently'}
                          </p>
                          {cred.rejectReason && <p className="text-xs text-red-600 mt-1">Reason: {cred.rejectReason}</p>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
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
                {formData.studentAddress && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Sent to</p>
                    <p className="font-mono text-xs break-all">{formData.studentAddress}</p>
                  </div>
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
