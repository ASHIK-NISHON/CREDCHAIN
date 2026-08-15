import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { verifyCredential, requestTransfer, resetTransfer, rejectCredential } from '../lib/api/verification'
import { optInAndReceiveAsset } from '../lib/algorand/nft'
import type { VerificationResult } from '../lib/api/verification'
import AppNav from '../components/layout/AppNav'
import WalletConnect from '../components/wallet/WalletConnect'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Spinner } from '../components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'

export default function ClaimCredential() {
  const { assetId } = useParams<{ assetId: string }>()
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [credential, setCredential] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingOwnership, setCheckingOwnership] = useState(false)
  const [optingIn, setOptingIn] = useState(false)
  const [optedIn, setOptedIn] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => {
    if (assetId) {
      loadCredential()
    }
  }, [assetId])

  const loadCredential = async () => {
    if (!assetId) return

    setLoading(true)
    try {
      const result = await verifyCredential(assetId)
      setCredential(result)
    } catch (error) {
      console.error('Failed to load credential:', error)
      enqueueSnackbar('Failed to load credential', { variant: 'error' })
      setCredential({ status: 'INVALID', assetId: assetId!, error: 'Failed to load' })
    } finally {
      setLoading(false)
    }
  }

  const checkOwnership = async () => {
    if (!assetId || !activeAddress || !transactionSigner) return

    setCheckingOwnership(true)
    try {
      const { checkAssetOwnership, checkAssetOptedIn } = await import('../lib/algorand/verification')
      const hasAsset = await checkAssetOwnership(activeAddress, BigInt(assetId))
      const optedIn = await checkAssetOptedIn(activeAddress, BigInt(assetId))

      if (credential?.rejected) {
        enqueueSnackbar('This credential was rejected and cannot be received.', { variant: 'warning' })
      } else if (hasAsset) {
        enqueueSnackbar('You own this credential!', { variant: 'success' })
      } else if (optedIn) {
        enqueueSnackbar('You have opted in! Ask the issuer to transfer the credential to your wallet.', { variant: 'info' })
      } else {
        enqueueSnackbar('You do not own this credential yet. Click "Opt In & Receive" to get it.', { variant: 'warning' })
      }
    } catch (error) {
      console.error('Error checking ownership:', error)
    } finally {
      setCheckingOwnership(false)
    }
  }

  const handleOptIn = async () => {
    if (!assetId || !activeAddress || !transactionSigner) return

    setOptingIn(true)
    try {
      // Step 1: Opt-in to the asset (blockchain)
      await optInAndReceiveAsset(assetId, activeAddress, transactionSigner)

      // Step 2: Verify on-chain that opt-in actually succeeded
      const { checkAssetOptedIn } = await import('../lib/algorand/verification')
      const actuallyOptedIn = await checkAssetOptedIn(activeAddress, assetId)

      if (!actuallyOptedIn) {
        throw new Error('Wallet approval was not completed. Please try again and approve the transaction in your wallet.')
      }

      // Step 3: Request transfer from issuer (marks in DB)
      await requestTransfer(assetId, activeAddress)

      // Step 4: Verify the DB was actually updated
      const result = await verifyCredential(assetId)
      if (!result.transferRequested) {
        throw new Error('Failed to register your request. Please try again.')
      }

      // Only set optedIn to true after all steps succeed
      setOptedIn(true)
      enqueueSnackbar('Successfully opted in! Requesting transfer from issuer...', { variant: 'success' })

      // Reload to get fresh data
      loadCredential()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error:', error)
      
      // More helpful error messages
      if (message.includes('insufficient funds') || message.includes('balance') || message.includes('overspend') || message.includes('status 400')) {
        enqueueSnackbar('Insufficient ALGO in your account to make the transaction. Please fund some test ALGO as mentioned above.', { variant: 'error' })
      } else if (message.includes('rejected') || message.includes('denied')) {
        enqueueSnackbar('Transaction rejected in wallet. Please approve the transaction to claim your credential.', { variant: 'error' })
      } else if (message.includes('timeout')) {
        enqueueSnackbar('Transaction timed out. Please try again and approve in your wallet.', { variant: 'error' })
      } else {
        enqueueSnackbar(`Failed: ${message}`, { variant: 'error' })
      }
      
      setOptedIn(false)
    } finally {
      setOptingIn(false)
    }
  }

  // Reset the opted in state and reload
  const handleResetOptIn = async () => {
    if (!assetId || !activeAddress) return

    try {
      // Reset the transfer request in the database
      await resetTransfer(assetId, activeAddress)

      // Verify the DB was actually reset
      const result = await verifyCredential(assetId)
      if (result.transferRequested) {
        throw new Error('Failed to reset. Please try again.')
      }

      // Reset local state and reload
      setOptedIn(false)
      loadCredential()
      enqueueSnackbar('Reset successful. You can try again.', { variant: 'info' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error resetting:', error)
      enqueueSnackbar(`Failed to reset: ${message}`, { variant: 'error' })
    }
  }

  // Check if transfer was requested (student opted in) - only use DB status
  const hasRequestedTransfer = credential?.transferRequested

  const handleReject = async () => {
    if (!assetId || !activeAddress) return

    setRejecting(true)
    try {
      await rejectCredential(assetId, activeAddress)
      enqueueSnackbar('You have rejected this credential. The issuer has been notified.', { variant: 'info' })
      setShowRejectDialog(false)
      loadCredential()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error rejecting:', error)
      enqueueSnackbar(`Failed to reject: ${message}`, { variant: 'error' })
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="mb-6 font-display text-3xl font-bold">View Credential</h1>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner className="h-6 w-6 text-primary" />
            <p className="mt-4 text-muted-foreground">Loading credential...</p>
          </div>
        ) : !credential ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Credential not found</p>
            </CardContent>
          </Card>
        ) : credential.status === 'REVOKED' ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Credential Revoked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">This credential has been revoked and cannot be claimed.</p>
            </CardContent>
          </Card>
        ) : credential.rejected ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Credential Declined</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">This credential was declined by the student.</p>
            </CardContent>
          </Card>
        ) : credential.burned ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Credential Burned</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">This credential has been burned and is no longer valid.</p>
            </CardContent>
          </Card>
        ) : credential.removedFromWallet ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Credential Removed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">This credential was removed from the wallet by the student.</p>
            </CardContent>
          </Card>
        ) : credential.status === 'INVALID' ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Invalid Credential</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{credential.error || 'This credential could not be verified.'}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">{credential.credential?.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Issued to</p>
                <p className="font-medium">{credential.credential?.studentName}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-medium">{new Date(credential.credential?.issueDate || '').toLocaleDateString()}</p>
              </div>

              {credential.credential?.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{credential.credential.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Issuer</p>
                <p className="font-mono text-sm">{credential.credential?.issuerAddress}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Asset ID</p>
                <p className="font-mono text-sm">{credential.assetId}</p>
              </div>

              {activeAddress && !credential.rejected && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-medium">
                      💡 <strong>Need Testnet ALGO?</strong> You need a small amount of test ALGO to opt-in and claim credentials.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Get free test ALGO from{' '}
                      <a
                        href="https://bank.testnet.algorand.network"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline hover:text-primary/80"
                      >
                        Algorand Testnet Dispenser
                      </a>{' '}
                      - just login, paste your wallet address, enter amount and click "Fund".
                    </p>
                  </div>
                  <Button
                    onClick={handleOptIn}
                    disabled={optingIn || hasRequestedTransfer || optedIn}
                    variant={hasRequestedTransfer || optedIn ? 'outline' : 'default'}
                    className="w-full"
                  >
                    {optingIn ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        Processing...
                      </>
                    ) : hasRequestedTransfer || optedIn ? (
                      '✅ Opted In - Waiting for Issuer'
                    ) : (
                      'Opt In & Receive Credential'
                    )}
                  </Button>

                  {(hasRequestedTransfer || optedIn) && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p className="text-sm text-emerald-600 font-medium">✅ You have successfully opted in!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        The issuer has been notified. Once they transfer the credential, it will appear in your{' '}
                        <strong>My Credentials</strong> page.
                      </p>
                      <Button variant="link" size="sm" className="mt-2 p-0 h-auto text-primary" onClick={handleResetOptIn}>
                        Need to try again? Click here to reset
                      </Button>
                    </div>
                  )}

                  {!optedIn && optingIn && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                      <p className="text-sm text-amber-600 font-medium">
                        📱 Please open your wallet and approve the transaction to claim this credential
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!activeAddress && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-3">Connect your wallet to receive the credential.</p>
                  <WalletConnect required />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
