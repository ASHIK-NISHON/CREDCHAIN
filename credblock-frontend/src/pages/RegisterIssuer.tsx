import { useState } from 'react'
import { useWallet, ScopeType } from '@txnlab/use-wallet-react'
import { canonify } from 'canonify'
import { useSnackbar } from 'notistack'
import { useNavigate } from 'react-router-dom'
import AppNav from '../components/layout/AppNav'
import WalletConnect from '../components/wallet/WalletConnect'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { apiClient } from '../lib/api/client'

export default function RegisterIssuer() {
  const { activeAddress, signData, activeWallet } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const navigate = useNavigate()

  const [step, setStep] = useState<'connect' | 'register' | 'verify' | 'success'>('connect')
  const [issuerName, setIssuerName] = useState('')
  const [challenge, setChallenge] = useState('')
  const [challengeMessage, setChallengeMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect wallet first', { variant: 'warning' })
      return
    }

    setIsLoading(true)
    try {
      const res = await apiClient.post('/api/issuers/register', { address: activeAddress })
      setChallenge(res.data.challenge)
      setChallengeMessage(res.data.message)
      setStep('verify')
      enqueueSnackbar('Challenge generated! Now sign to verify.', { variant: 'success' })
    } catch (err: any) {
      enqueueSnackbar(err.response?.data?.error || 'Failed to register', { variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect wallet first', { variant: 'warning' })
      return
    }

    if (!challenge) {
      enqueueSnackbar('Generate challenge first', { variant: 'warning' })
      return
    }

    if (!signData) {
      enqueueSnackbar('Wallet does not support message signing. Please use Lute wallet.', { variant: 'error' })
      return
    }

    setIsLoading(true)
    const siwaRequest = {
      domain: window.location.host,
      chain_id: '283',
      account_address: activeAddress,
      type: 'ed25519',
      uri: window.location.origin,
      version: '1',
      'issued-at': new Date().toISOString(),
    }
    const canonifiedJson = canonify(siwaRequest)
    const dataToSign = btoa(canonifiedJson || '')

    enqueueSnackbar('Signing request sent to your wallet. Please approve in Lute wallet.', { variant: 'info' })

    const timeoutMs = 60000
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Signing timed out. Is Lute wallet extension working?')), timeoutMs),
    )

    try {
      const resp = (await Promise.race([signData(dataToSign, { scope: ScopeType.AUTH, encoding: 'base64' }), timeoutPromise])) as {
        signature: Uint8Array
        authenticatorData: Uint8Array
      }

      const signature = new Uint8Array(resp.signature)
      const signatureBase64 = btoa(String.fromCharCode(...signature))
      const authenticatorDataBase64 = btoa(String.fromCharCode(...resp.authenticatorData))

      const requestBody = {
        address: activeAddress,
        signature: signatureBase64,
        data: dataToSign,
        authenticatorData: authenticatorDataBase64,
        name: issuerName || undefined,
      }

      enqueueSnackbar('Verifying your signature...', { variant: 'info' })

      const res = await apiClient.post('/api/issuers/verify', requestBody)

      if (res.data.success) {
        setStep('success')
        enqueueSnackbar('Issuer registered successfully!', { variant: 'success' })
        setTimeout(() => {
          navigate('/issuer')
          window.location.reload()
        }, 1500)
      }
    } catch (err: any) {
      enqueueSnackbar(err.response?.data?.error || err.message || 'Failed to verify', { variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="font-display text-4xl font-bold mb-2">Issuer Registration</h1>
        <p className="text-muted-foreground mb-4">Register your wallet to start issuing credentials.</p>

        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-600 font-medium">
            ⚠️ <strong>Required:</strong> You must use <strong>Lute Wallet</strong> to register as an issuer. Other wallets do
            not support message signing required for verification.
          </p>
          <p className="text-sm text-muted-foreground mt-2">Lute is the only wallet that supports message signing required for verification.</p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-600 font-medium">
            You need Testnet ALGO to sign &amp; verify.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Get it now from the{' '}
            <a
              href="https://bank.testnet.algorand.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80 font-medium"
            >
              Algorand Testnet Dispenser
            </a>
            — Log in, paste your wallet address, and click Fund.
          </p>
        </div>

        {!activeAddress ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Connect Lute Wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Connect your Lute wallet to register as an issuer.</p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-600">
                  <strong>Important:</strong> Only Lute Wallet is supported for issuer registration.
                </p>
              </div>
              <WalletConnect required />
            </CardContent>
          </Card>
        ) : step === 'success' ? (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="font-display text-emerald-500">Success!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">You are now a registered issuer.</p>
              <p className="font-mono text-sm break-all">{activeAddress}</p>
              <p className="text-sm text-muted-foreground">Redirecting to issuer dashboard...</p>
            </CardContent>
          </Card>
        ) : step === 'verify' ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Sign Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Display Name (Optional)</Label>
                <Input
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="Your organization name"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label>Message to Sign</Label>
                <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono break-all min-h-[80px]">{challengeMessage}</div>
              </div>
              <Button onClick={handleVerify} disabled={isLoading || !signData} className="w-full">
                {isLoading ? 'Signing...' : 'Sign & Verify'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Register</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Click below to generate a challenge and register.</p>
              <Button onClick={handleRegister} disabled={isLoading} className="w-full">
                {isLoading ? 'Generating...' : 'Generate Challenge'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
