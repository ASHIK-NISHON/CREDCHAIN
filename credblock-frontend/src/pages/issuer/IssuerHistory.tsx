import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { motion } from 'framer-motion'
import AppNav from '../../components/layout/AppNav'
import WalletConnect from '../../components/wallet/WalletConnect'
import { checkIssuer, IssuerProfile } from '../../lib/api/issuers'
import { getCredentialsForIssuer } from '../../lib/api/verification'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Spinner } from '../../components/ui/spinner'

interface CredentialHistory {
  id: string
  assetId: string
  title: string
  studentName: string
  studentAddress: string
  issueDate: string
  description?: string
  transferred?: boolean
  rejected?: boolean
  rejectedAt?: string
  rejectReason?: string
  transferRequested?: boolean
  createdAt?: string
}

type FilterStatus = 'all' | 'claimed' | 'pending' | 'rejected'

export default function IssuerHistoryPage() {
  const { activeAddress } = useWallet()
  const [credentials, setCredentials] = useState<CredentialHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
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

    const loadCredentials = async () => {
      setLoading(true)
      try {
        const creds = await getCredentialsForIssuer(activeAddress)
        setCredentials(creds)
      } catch (e) {
        console.error('Failed to load credentials:', e)
      } finally {
        setLoading(false)
      }
    }

    loadCredentials()
  }, [activeAddress, issuerStatus.isVerified])

  const filteredCredentials = credentials.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'claimed') return c.transferred && !c.rejected
    if (filter === 'pending') return c.transferRequested && !c.transferred && !c.rejected
    if (filter === 'rejected') return c.rejected
    return true
  })

  const stats = {
    total: credentials.length,
    claimed: credentials.filter((c) => c.transferred && !c.rejected).length,
    pending: credentials.filter((c) => c.transferRequested && !c.transferred && !c.rejected).length,
    rejected: credentials.filter((c) => c.rejected).length,
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <div className="container mx-auto px-4 py-8">
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-bold mb-8">
          Issued Credentials History
        </motion.h1>

        {!activeAddress ? (
          <Card className="mx-auto max-w-xl">
            <CardHeader>
              <CardTitle className="font-display">Connect wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Please connect your wallet to view history.</p>
              <WalletConnect required />
            </CardContent>
          </Card>
        ) : !issuerStatus.isVerified ? (
          <Card className="mx-auto max-w-xl border-yellow-500/20 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="font-display text-yellow-500">Verification Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">You need to verify your issuer account to view credential history.</p>
              <Button asChild className="w-full">
                <Link to="/register-issuer">Verify Issuer Account</Link>
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner className="h-6 w-6 text-primary" />
            <p className="mt-4 text-muted-foreground">Loading credentials...</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Issued</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Claimed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-600">{stats.claimed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filter */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl font-semibold">All Credentials ({filteredCredentials.length})</h2>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterStatus)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="claimed">Claimed</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Table */}
            {filteredCredentials.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No credentials found for the selected filter.</CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Issue Date</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Asset ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredCredentials.map((cred) => (
                          <tr key={cred.assetId} className="hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <Link to={`/claim/${cred.assetId}`} className="font-medium hover:underline">
                                {cred.title}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium">{cred.studentName}</p>
                                <p className="text-xs text-muted-foreground font-mono">{cred.studentAddress.slice(0, 12)}...</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">{new Date(cred.issueDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              {cred.rejected ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  Rejected
                                </span>
                              ) : cred.transferred ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                  Claimed
                                </span>
                              ) : cred.transferRequested ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  Issued
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{cred.assetId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
