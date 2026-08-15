import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import WalletConnect from '../wallet/WalletConnect'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import { useRole } from '../../App'
import { useNotificationStore, fetchIssuerNotificationCounts, fetchStudentNotificationCounts } from './Notifications'

interface AppNavProps {
  showWallet?: boolean
  onRoleDetected?: (isIssuer: boolean, isVerified: boolean) => void
}

interface NavItem {
  label: string
  to: string
  notificationKey?: 'pending' | 'declined' | 'claims'
}

export default function AppNav({ showWallet = true, onRoleDetected }: AppNavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeAddress } = useWallet()
  const { role, isVerified, loading } = useRole()
  const isLanding = location.pathname === '/'

  // Local state for badge display - these are separate so we can clear them immediately on navigation
  const [pendingBadge, setPendingBadge] = useState(0)
  const [declinedBadge, setDeclinedBadge] = useState(0)
  const [claimsBadge, setClaimsBadge] = useState(0)

  // Persisted store for lastViewed timestamps (synced with backend)
  const { pendingLastViewed, declinedLastViewed, claimsLastViewed, setPendingLastViewed, setDeclinedLastViewed, setClaimsLastViewed, resetPendingCount, resetDeclinedCount, resetClaimsCount } =
    useNotificationStore()

  // Check if user is on a notification page - on these pages, we shouldn't show badges
  const isOnPendingPage = location.pathname === '/issuer/pending'
  const isOnDeclinedPage = location.pathname === '/issuer/declined'
  const isOnClaimsPage = location.pathname === '/student/claims'
  const isOnNotificationPage = isOnPendingPage || isOnDeclinedPage || isOnClaimsPage

  // Mark notifications as read when user navigates to the notification pages
  useEffect(() => {
    const now = new Date().toISOString()
    if (isOnPendingPage) {
      setPendingLastViewed(now)
      setPendingBadge(0)
      resetPendingCount()
    } else if (isOnDeclinedPage) {
      setDeclinedLastViewed(now)
      setDeclinedBadge(0)
      resetDeclinedCount()
    } else if (isOnClaimsPage) {
      setClaimsLastViewed(now)
      setClaimsBadge(0)
      resetClaimsCount()
    }
  }, [location.pathname])

  // Fetch notification counts - skip when on the notification page itself
  useEffect(() => {
    if (!activeAddress || !role || loading || isOnNotificationPage) return

    const fetchCounts = async () => {
      if (role === 'issuer') {
        const counts = await fetchIssuerNotificationCounts(activeAddress, pendingLastViewed)
        setPendingBadge(counts.pendingCount)
        setDeclinedBadge(counts.declinedCount)
      } else if (role === 'student') {
        const counts = await fetchStudentNotificationCounts(activeAddress, claimsLastViewed)
        setClaimsBadge(counts.claimsCount)
      }
    }

    fetchCounts()

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchCounts, 30000)
    return () => clearInterval(interval)
  }, [activeAddress, role, loading, pendingLastViewed, claimsLastViewed, isOnNotificationPage])

  useEffect(() => {
    if (!loading && activeAddress) {
      onRoleDetected?.(role === 'issuer', isVerified)
    }
  }, [role, isVerified, loading, activeAddress, onRoleDetected])

  const issuerNavItems: NavItem[] = [
    { label: 'Dashboard', to: '/issuer/dashboard' },
    { label: 'Issue', to: '/issuer/issue' },
    { label: 'History', to: '/issuer/history' },
    { label: 'Pending', to: '/issuer/pending', notificationKey: 'pending' },
    { label: 'Declined', to: '/issuer/declined', notificationKey: 'declined' },
  ]

  const studentNavItems: NavItem[] = [
    { label: 'Dashboard', to: '/student/dashboard' },
    { label: 'My Credentials', to: '/student/credentials' },
    { label: 'Claims', to: '/student/claims', notificationKey: 'claims' },
  ]

  const navItems = isVerified ? issuerNavItems : studentNavItems

  // When on a notification page, don't show the badge for that page
  const getNotificationBadge = (key?: 'pending' | 'declined' | 'claims') => {
    if (!key) return null

    // Hide badge if we're on that page
    if ((key === 'pending' && isOnPendingPage) || (key === 'declined' && isOnDeclinedPage) || (key === 'claims' && isOnClaimsPage)) {
      return null
    }

    let count = 0
    if (key === 'pending') {
      count = pendingBadge
    } else if (key === 'declined') {
      count = declinedBadge
    } else if (key === 'claims') {
      count = claimsBadge
    }

    if (count === 0) return null

    return <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">{count > 99 ? '99+' : count}</span>
  }

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300',
        isLanding ? 'border-white/10 bg-black/10' : 'bg-background/70',
      )}
    >
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link
          to="/"
          className={cn(
            'font-display text-xl font-bold tracking-tight transition-colors',
            isLanding ? 'text-white hover:text-white/90' : 'text-foreground hover:text-primary',
          )}
        >
          CredBlock
        </Link>
        <div className="flex items-center gap-4">
          {!isLanding && activeAddress && role && !loading && (
            <div className="flex gap-1">
              {navItems.map((item, idx) => (
                <Button
                  key={`${item.to}-${idx}`}
                  asChild
                  variant={location.pathname.startsWith(item.to.split('/').slice(0, 2).join('/')) ? 'secondary' : 'ghost'}
                  size="sm"
                >
                  <Link to={item.to}>
                    {item.label}
                    {getNotificationBadge(item.notificationKey)}
                  </Link>
                </Button>
              ))}
            </div>
          )}
          {showWallet && <WalletConnect required={!isLanding} onRoleDetected={onRoleDetected} />}
        </div>
      </div>
    </motion.nav>
  )
}