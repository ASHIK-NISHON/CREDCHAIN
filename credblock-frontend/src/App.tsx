import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { SupportedWallet, WalletId, WalletManager, WalletProvider, useWallet } from '@txnlab/use-wallet-react'
import type {} from '@txnlab/use-wallet'
import { SnackbarProvider } from 'notistack'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getKmdConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
import Landing from './pages/Landing'
import Verification from './pages/Verification'
import ClaimCredential from './pages/ClaimCredential'
import RegisterIssuer from './pages/RegisterIssuer'

// Issuer pages
import IssuerDashboardPage from './pages/issuer/IssuerDashboard'
import IssuerIssuePage from './pages/issuer/IssuerIssue'
import IssuerHistoryPage from './pages/issuer/IssuerHistory'
import IssuerPendingPage from './pages/issuer/IssuerPending'
import IssuerDeclinedPage from './pages/issuer/IssuerDeclined'

// Student pages
import StudentDashboardPage from './pages/student/StudentDashboard'
import StudentCredentialsPage from './pages/student/StudentCredentials'
import StudentClaimsPage from './pages/student/StudentClaims'

import { checkIssuer } from './lib/api/issuers'

// Role context
interface RoleContextType {
  role: 'issuer' | 'student' | null
  isVerified: boolean
  loading: boolean
  refreshRole: () => void
}

const RoleContext = createContext<RoleContextType>({ role: null, isVerified: false, loading: true, refreshRole: () => {} })

export const useRole = () => useContext(RoleContext)

// Role provider component
function RoleProvider({ children }: { children: React.ReactNode }) {
  const { activeAddress } = useWallet()
  const [role, setRole] = useState<'issuer' | 'student' | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const refreshKey = useRef(0)

  const refreshRole = () => {
    refreshKey.current += 1
    checkRole()
  }

  const checkRole = async () => {
    if (!activeAddress) {
      setRole(null)
      setIsVerified(false)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const status = await checkIssuer(activeAddress)
      setRole(status.isVerified ? 'issuer' : 'student')
      setIsVerified(status.isVerified)
    } catch {
      console.error('Failed to check role')
      setRole('student')
      setIsVerified(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkRole()
  }, [activeAddress, refreshKey.current])

  return <RoleContext.Provider value={{ role, isVerified, loading, refreshRole }}>{children}</RoleContext.Provider>
}

// Protected route wrapper
function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole: 'issuer' | 'student' }) {
  const { role, isVerified, loading } = useRole()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (requiredRole === 'issuer' && !isVerified) {
    return <Navigate to="/" replace />
  }

  if (requiredRole === 'student' && role === 'issuer' && isVerified) {
    return <Navigate to="/issuer/dashboard" replace />
  }

  return <>{children}</>
}

let supportedWallets: SupportedWallet[]
if (import.meta.env.VITE_ALGOD_NETWORK === 'localnet') {
  const kmdConfig = getKmdConfigFromViteEnvironment()
  supportedWallets = [
    { id: WalletId.PERA },
    { id: WalletId.DEFLY },
    { id: WalletId.LUTE },
    { id: WalletId.EXODUS },
    {
      id: WalletId.KMD,
      options: {
        baseServer: kmdConfig.server,
        token: String(kmdConfig.token),
        port: String(kmdConfig.port),
      },
    },
  ]
} else {
  supportedWallets = [{ id: WalletId.PERA }, { id: WalletId.DEFLY }, { id: WalletId.LUTE }, { id: WalletId.EXODUS }]
}

export default function App() {
  const algodConfig = getAlgodConfigFromViteEnvironment()

  const getPort = () => {
    const port = import.meta.env.VITE_ALGOD_PORT
    return port && port.trim() !== '' ? port : algodConfig.network === 'localnet' ? '4001' : undefined
  }

  const walletManager = new WalletManager({
    wallets: supportedWallets,
    defaultNetwork: algodConfig.network,
    networks: {
      [algodConfig.network]: {
        algod: {
          baseServer: algodConfig.server,
          port: getPort(),
          token: String(algodConfig.token),
        },
      },
    },
    options: {
      resetNetwork: true,
    },
  })

  return (
    <SnackbarProvider maxSnack={3}>
      <WalletProvider manager={walletManager}>
        <RoleProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/verify/:assetId" element={<Verification />} />
              <Route path="/claim/:assetId" element={<ClaimCredential />} />
              <Route path="/register-issuer" element={<RegisterIssuer />} />

              {/* Issuer routes */}
              <Route
                path="/issuer/dashboard"
                element={
                  <ProtectedRoute requiredRole="issuer">
                    <IssuerDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/issuer/issue"
                element={
                  <ProtectedRoute requiredRole="issuer">
                    <IssuerIssuePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/issuer/history"
                element={
                  <ProtectedRoute requiredRole="issuer">
                    <IssuerHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/issuer/pending"
                element={
                  <ProtectedRoute requiredRole="issuer">
                    <IssuerPendingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/issuer/declined"
                element={
                  <ProtectedRoute requiredRole="issuer">
                    <IssuerDeclinedPage />
                  </ProtectedRoute>
                }
              />

              {/* Student routes */}
              <Route
                path="/student/dashboard"
                element={
                  <ProtectedRoute requiredRole="student">
                    <StudentDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/credentials"
                element={
                  <ProtectedRoute requiredRole="student">
                    <StudentCredentialsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/claims"
                element={
                  <ProtectedRoute requiredRole="student">
                    <StudentClaimsPage />
                  </ProtectedRoute>
                }
              />

              {/* Legacy routes redirect */}
              <Route path="/issuer" element={<Navigate to="/issuer/dashboard" replace />} />
              <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </RoleProvider>
      </WalletProvider>
    </SnackbarProvider>
  )
}
