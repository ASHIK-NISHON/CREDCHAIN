import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { motion } from 'framer-motion'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import AppNav from '../../components/layout/AppNav'
import WalletConnect from '../../components/wallet/WalletConnect'
import { checkIssuer, IssuerProfile } from '../../lib/api/issuers'
import { getPendingTransfers, completeTransfer } from '../../lib/api/verification'
import { getAlgodConfigFromViteEnvironment } from '../../utils/network/getAlgoClientConfigs'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Spinner } from '../../components/ui/spinner'

interface PendingCredential {
  id: string
  assetId: string
  studentAddress: string
  studentName: string
  title: string
  transferRequested: boolean
}

export default function IssuerPendingPage() {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [pending, setPending] = useState<PendingCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState<string | null>(null)
  const [showWalletPrompt, setShowWalletPrompt] = useState(false)
  const [issuerStatus, setIssuerStatus] = useState<{ isIssuer: boolean; isVerified: boolean; profile: IssuerProfile | null }>({
    isIssuer: false,
    isVerified: false,
    profile: null,
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
        setIssuerStatus({ isIssuer: false, isVerified: false, profile: null })
      }
    }

    checkStatus()
  }, [activeAddress])

  useEffect(() => {
    if (!activeAddress || !issuerStatus.isVerified) return

    const loadPending = async () => {
      try {
        const data = await getPendingTransfers(activeAddress)
        setPending(data)
      } catch (e) {
        console.error('Failed to load pending:', e)
      } finally {
        setLoading(false)
      }
    }

    loadPending()
    const interval = setInterval(loadPending, 30000)
    return () => clearInterval(interval)
  }, [activeAddress, issuerStatus.isVerified])

  const handleTransfer = async (assetId: string, studentAddress: string) => {
    if (!activeAddress || !transactionSigner) return

    setTransferring(assetId)
    setShowWalletPrompt(true)
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

      await completeTransfer(assetId, result.txIds[0] || '')

      enqueueSnackbar(hasAsset ? 'Credential transferred to student!' : 'Transfer completed', { variant: 'success' })

      setPending((prev) => prev.filter((p) => p.assetId !== assetId))
    } catch (error: any) {
      console.error('Transfer error:', error)
      enqueueSnackbar(`Failed to transfer: ${error.message || 'Unknown'}`, { variant: 'error' })
    } finally {
      setTransferring(null)
      setShowWalletPrompt(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <div className="container mx-auto px-4 py-8">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-bold mb-8">
          Pending Transfers
        </motion.h1>

        {!activeAddress ? (
          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle className="font-display">Connect wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Please connect your wallet to view pending transfers.</p>
              <WalletConnect required />
            </CardContent>
          </Card>
        ) : !issuerStatus.isVerified ? (
          <Card className="mx-auto max-w-xl border-yellow-500/20 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="font-display text-yellow-500">Verification Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">You need to verify your issuer account to view pending transfers.</p>
              <Button asChild className="w-full">
                <Link to="/register-issuer">Verify Issuer Account</Link>
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner className="h-6 w-6 text-primary" />
            <p className="mt-4 text-muted-foreground">Loading pending transfers...</p>
          </div>
        ) : pending.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-lg font-semibold mb-2">No Pending Transfers</h3>
              <p className="text-muted-foreground">When students opt-in to receive credentials, they will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground mb-4">
              These students have opted in to receive credentials. Click "Transfer" to complete the transfer.
            </p>

            {showWalletPrompt && transferring && (
              <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
                <Spinner className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-blue-600">Please open your wallet and approve the transaction</p>
                  <p className="text-sm text-muted-foreground">This may take a few moments...</p>
                </div>
              </div>
            )}

            {pending.map((cred) => (
              <Card key={cred.id} className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                      <Link to={`/verify/${cred.assetId}`} className="font-medium text-lg hover:underline">
                        {cred.title}
                      </Link>
                      <p className="text-muted-foreground">
                        Student: {cred.studentName} ({cred.studentAddress.slice(0, 8)}...)
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">Asset ID: {cred.assetId}</p>
                    </div>
                    <Button
                      onClick={() => handleTransfer(cred.assetId, cred.studentAddress)}
                      disabled={transferring === cred.assetId}
                      className="shrink-0"
                    >
                      {transferring === cred.assetId ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2" />
                          Transferring...
                        </>
                      ) : (
                        'Transfer'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
