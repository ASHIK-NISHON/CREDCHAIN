import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { verifyCredential, VerificationResult } from '../lib/api/verification'
import AppNav from '../components/layout/AppNav'
import StatusBanner from '../components/verification/StatusBanner'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Spinner } from '../components/ui/spinner'
import { Button } from '../components/ui/button'

export default function Verification() {
  const { assetId } = useParams<{ assetId: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (assetId) {
      loadVerification()
    }
  }, [assetId])

  const loadVerification = async () => {
    if (!assetId) return

    setLoading(true)
    try {
      const verificationResult = await verifyCredential(assetId)
      setResult(verificationResult)
    } catch (error) {
      console.error('Verification failed:', error)
      setResult({
        status: 'INVALID',
        assetId,
        error: 'Failed to verify credential',
      })
    } finally {
      setLoading(false)
    }
  }

  const network = import.meta.env.VITE_ALGOD_NETWORK || 'testnet'
  const explorerUrl = import.meta.env.VITE_ALGORAND_EXPLORER || (network === 'localnet' ? null : 'https://testnet.explorer.perawallet.app')

  return (
    <div className="min-h-screen bg-background">
      <AppNav showWallet={false} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {!loading && (
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
            ← Back
          </Button>
        )}

        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16">
            <Spinner className="h-6 w-6 text-primary" />
            <p className="mt-4 text-muted-foreground">Verifying credential...</p>
          </motion.div>
        ) : result ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <StatusBanner status={result.status} />

            {result.status === 'VERIFIED' && result.credential && (
              <>
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="font-display text-3xl">{result.credential.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 mb-6">
                      <div>
                        <span className="text-sm text-muted-foreground">Student</span>
                        <p className="font-semibold">{result.credential.studentName}</p>
                      </div>

                      {result.credential.description && (
                        <div>
                          <span className="text-sm text-muted-foreground">Description</span>
                          <p>{result.credential.description}</p>
                        </div>
                      )}

                      <div>
                        <span className="text-sm text-muted-foreground">Issued</span>
                        <p>{new Date(result.credential.issueDate).toLocaleDateString()}</p>
                      </div>

                      {result.credential.expiryDate && (
                        <div>
                          <span className="text-sm text-muted-foreground">Expires</span>
                          <p>{new Date(result.credential.expiryDate).toLocaleDateString()}</p>
                        </div>
                      )}

                      <div>
                        <span className="text-sm text-muted-foreground">Issuer</span>
                        <p className="font-mono text-sm break-all">{result.credential.issuerAddress}</p>
                      </div>
                    </div>

                    {result.credential.certificateIpfsUrl && (
                      <div className="mb-6">
                        <h3 className="mb-2 font-semibold">Certificate</h3>
                        <iframe src={result.credential.certificateIpfsUrl} className="h-96 w-full rounded-xl border" title="Certificate" />
                        <a
                          href={result.credential.certificateIpfsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                        >
                          Open certificate →
                        </a>
                      </div>
                    )}

                    <div className="border-t pt-6">
                      <h3 className="mb-4 font-semibold">Blockchain</h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Asset ID </span>
                          {explorerUrl ? (
                            <a
                              href={`${explorerUrl}/asset/${result.assetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 font-mono text-primary hover:underline"
                            >
                              {result.assetId}
                            </a>
                          ) : (
                            <span className="font-mono ml-2">{result.assetId}</span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Transaction </span>
                          {explorerUrl ? (
                            <a
                              href={`${explorerUrl}/tx/${result.credential.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 font-mono text-primary hover:underline"
                            >
                              {result.credential.transactionHash.substring(0, 20)}...
                            </a>
                          ) : (
                            <span className="font-mono ml-2">{result.credential.transactionHash.substring(0, 20)}...</span>
                          )}
                        </div>
                        {result.assetInfo && result.credential.metadataIpfsUrl && (
                          <div>
                            <span className="text-muted-foreground">Metadata </span>
                            <a
                              href={result.credential.metadataIpfsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 break-all text-primary hover:underline"
                            >
                              {result.credential.metadataIpfsUrl}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {result.rejected && (
                  <Card className="mt-4 border-amber-500/30 bg-amber-500/5">
                    <CardContent className="py-4">
                      <p className="text-amber-600 font-medium">⚠️ This credential was rejected by the student</p>
                      {result.rejectedAt && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Rejected on: {new Date(result.rejectedAt).toLocaleDateString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {result.status === 'REVOKED' && result.revocationInfo && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="font-display text-2xl">Credential Revoked</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.revocationInfo.revokedAt && (
                    <p className="mb-2 text-muted-foreground">
                      Revoked on: {new Date(result.revocationInfo.revokedAt).toLocaleDateString()}
                    </p>
                  )}
                  {result.revocationInfo.reason && <p className="text-muted-foreground">Reason: {result.revocationInfo.reason}</p>}
                </CardContent>
              </Card>
            )}

            {result.status === 'INVALID' && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="font-display text-2xl">Credential Invalid</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{result.error || 'This credential could not be verified.'}</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No verification result available</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
