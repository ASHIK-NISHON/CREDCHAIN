import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { motion } from 'framer-motion'
import AppNav from '../../components/layout/AppNav'
import WalletConnect from '../../components/wallet/WalletConnect'
import { issueCredential, IssueCredentialParams } from '../../lib/api/credentials'
import { checkIssuer, IssuerProfile } from '../../lib/api/issuers'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Spinner } from '../../components/ui/spinner'
import { Textarea } from '../../components/ui/textarea'

export default function IssuerIssuePage() {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [result, setResult] = useState<{ assetId: string; txId: string } | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)
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

    // Scroll to progress section
    setTimeout(() => {
      progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)

    try {
      if (!transactionSigner) {
        enqueueSnackbar('Wallet not ready. Please reconnect your wallet.', { variant: 'error' })
        return
      }

      const submitData = {
        ...formData,
        issuerAddress: activeAddress,
      }

      const result = await issueCredential(submitData, transactionSigner, (step) => {
        setProgress((prev) => {
          const newProgress = [...prev, step]
          // Scroll to progress on each update
          setTimeout(() => {
            progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 50)
          return newProgress
        })
      })
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
      setProgress((prev) => [...prev, `Error: ${isNetworkError ? message : String(err.message)}`])
    } finally {
      setLoading(false)
    }
  }

  const network = import.meta.env.VITE_ALGOD_NETWORK || 'testnet'
  const explorerUrl = import.meta.env.VITE_ALGORAND_EXPLORER || (network === 'localnet' ? null : 'https://testnet.explorer.perawallet.app')

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-bold mb-8">
          Issue New Credential
        </motion.h1>

        {!activeAddress ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Connect wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">Please connect your wallet to issue credentials.</p>
                <WalletConnect required />
              </CardContent>
            </Card>
          </motion.div>
        ) : !issuerStatus.isVerified ? (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <Card className="border-yellow-500/20 bg-yellow-500/5">
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
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Credential Details</CardTitle>
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

                {loading && (
                  <div ref={progressRef} className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-3">Issuing Credential...</p>
                    <div className="space-y-2">
                      {progress.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-amber-500 animate-pulse">
                          <span>⏳</span>
                          <span>Starting...</span>
                        </div>
                      ) : (
                        progress.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {idx < progress.length - 1 ? (
                              <span className="text-green-500">✓</span>
                            ) : (
                              <span className="text-amber-500 animate-pulse">⏳</span>
                            )}
                            <span className={idx < progress.length - 1 ? 'text-muted-foreground' : ''}>{step}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
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
