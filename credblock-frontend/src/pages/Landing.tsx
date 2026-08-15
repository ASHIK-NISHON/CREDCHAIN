import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import AppNav from '../components/layout/AppNav'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { checkIssuer } from '../lib/api/issuers'
import { Spinner } from '../components/ui/spinner'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

export default function Landing() {
  const { activeAddress } = useWallet()
  const [issuerStatus, setIssuerStatus] = useState<{ isIssuer: boolean; isVerified: boolean } | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!activeAddress) {
      setIssuerStatus(null)
      return
    }

    const checkStatus = async () => {
      setChecking(true)
      try {
        const status = await checkIssuer(activeAddress)
        setIssuerStatus(status)
      } catch (e) {
        console.error('Failed to check issuer status:', e)
        setIssuerStatus({ isIssuer: false, isVerified: false })
      } finally {
        setChecking(false)
      }
    }

    checkStatus()
  }, [activeAddress])

  return (
    <div className="min-h-screen gradient-mesh relative overflow-hidden">
      <div className="grain" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" />
        <div
          className="absolute top-1/2 -left-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '1s' }}
        />
      </div>

      <AppNav />

      <div className="container mx-auto px-4 py-12 sm:py-20 relative">
        {/* Role Selection */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-16">
          <h2 className="text-2xl font-display font-bold text-white text-center mb-8">Choose Your Path</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Issuer Card */}
            <motion.div
              whileHover={issuerStatus?.isVerified || !issuerStatus?.isIssuer ? { y: -8, scale: 1.02 } : {}}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Card
                className={`border-white/20 bg-white/10 backdrop-blur-xl h-full ${issuerStatus?.isIssuer && !issuerStatus?.isVerified ? 'opacity-50' : ''}`}
              >
                <CardHeader className="text-center pb-4">
                  <div className="text-5xl mb-3">🏢</div>
                  <CardTitle className="font-display text-2xl text-white">I'm an Issuer</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-white/80 mb-6">
                    Issue blockchain-verified credentials to your students. Track issuance history, manage pending transfers, and see
                    rejected credentials.
                  </p>
                  {checking ? (
                    <Spinner className="h-6 w-6 text-white" />
                  ) : issuerStatus?.isVerified ? (
                    <div className="space-y-3">
                      <p className="text-emerald-400 font-medium">✓ You are a verified issuer</p>
                      <Button asChild size="lg" className="w-full">
                        <Link to="/issuer/dashboard">Go to Issuer Dashboard</Link>
                      </Button>
                    </div>
                  ) : issuerStatus?.isIssuer ? (
                    <div className="space-y-3">
                      <p className="text-amber-400 font-medium">⚠ Registration incomplete</p>
                      <Button asChild size="lg" variant="outline" className="w-full border-white/30 text-white hover:bg-white/10">
                        <Link to="/register-issuer">Complete Verification</Link>
                      </Button>
                    </div>
                  ) : issuerStatus === null && activeAddress ? (
                    <div className="space-y-3">
                      <p className="text-white/60 text-sm">You are logged in as a student</p>
                      <p className="text-white/40 text-xs">Register as issuer to issue credentials</p>
                    </div>
                  ) : (
                    <Button asChild size="lg" className="w-full">
                      <Link to="/register-issuer">Register as Issuer</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Student Card */}
            <motion.div
              whileHover={issuerStatus?.isVerified ? {} : { y: -8, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Card className={`border-white/20 bg-white/10 backdrop-blur-xl h-full ${issuerStatus?.isVerified ? 'opacity-50' : ''}`}>
                <CardHeader className="text-center pb-4">
                  <div className="text-5xl mb-3">🎓</div>
                  <CardTitle className="font-display text-2xl text-white">I'm a Student</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-white/80 mb-6">
                    Receive and manage your credentials from universities and institutions. Claim, store, and share your verified
                    certificates.
                  </p>
                  {issuerStatus?.isVerified ? (
                    <div className="space-y-3">
                      <p className="text-amber-400 font-medium">⚠ You are registered as an issuer</p>
                      <p className="text-white/60 text-sm">Switch to issuer view to manage credentials</p>
                    </div>
                  ) : activeAddress ? (
                    <Button asChild size="lg" className="w-full">
                      <Link to="/student/dashboard">Go to Student Dashboard</Link>
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-white/60 text-sm">Connect your wallet to get started</p>
                      <p className="text-white/40 text-xs">Supported: Pera, Defly, Lute, Exodus</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.div variants={container} initial="hidden" animate="show" className="text-center mb-20">
          <motion.h1
            variants={item}
            className="font-display text-5xl sm:text-6xl md:text-7xl font-extrabold text-white mb-4 tracking-tight"
          >
            CredBlock
          </motion.h1>
          <motion.p variants={item} className="text-xl sm:text-2xl text-white/90 mb-6 max-w-2xl mx-auto font-medium">
            Blockchain-Verified Credentials on Algorand
          </motion.p>
          <p className="text-white/70 max-w-3xl mx-auto text-lg">
            Issue, receive, and verify academic credentials as blockchain-backed NFTs. 
            No more fake diplomas, no more verification delays.
          </p>
        </motion.div>

        {/* Why CredBlock */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <Card className="border-white/10 bg-white/5 text-white backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="font-display text-3xl sm:text-4xl text-center">Why CredBlock?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
                {[
                  { 
                    icon: '🚫', 
                    title: 'No More Fraud', 
                    description: 'Every credential is minted as an NFT on Algorand blockchain. Cannot be forged, fake diplomas eliminated.' 
                  },
                  { 
                    icon: '⏱️', 
                    title: 'Instant Verification', 
                    description: 'Verify any credential in seconds via QR code or link. No calls, no emails, no bureaucracy.' 
                  },
                  { 
                    icon: '💎', 
                    title: 'Student Ownership', 
                    description: 'Students own their credentials forever. Transferable, verifiable, always accessible.' 
                  },
                ].map((card) => (
                  <motion.div
                    key={card.title}
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="rounded-2xl p-6 sm:p-8 text-center border border-white/10 bg-white/5"
                  >
                    <div className="text-4xl mb-4">{card.icon}</div>
                    <h3 className="text-xl font-semibold text-white mb-2">{card.title}</h3>
                    <p className="text-white/80 text-sm sm:text-base">{card.description}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* How It Works */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <Card className="border-white/10 bg-white/5 text-white backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="font-display text-3xl sm:text-4xl text-center">How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
                {[
                  { 
                    step: '1', 
                    title: 'Issuer Mints', 
                    description: 'University uploads certificate. CredBlock mints it as ARC-3 NFT on Algorand blockchain.' 
                  },
                  { 
                    step: '2', 
                    title: 'Student Claims', 
                    description: 'Student connects wallet and receives credential directly. It lives in their wallet forever.' 
                  },
                  { 
                    step: '3', 
                    title: 'Anyone Verifies', 
                    description: 'Scan QR code or click link. Instantly see: who issued, to whom, when, and if valid.' 
                  },
                ].map((card) => (
                  <motion.div
                    key={card.step}
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="rounded-2xl p-6 sm:p-8 text-center border border-white/10 bg-white/5"
                  >
                    <div className="text-5xl font-display font-bold text-white/90 mb-4">{card.step}</div>
                    <h3 className="text-xl font-semibold text-white mb-2">{card.title}</h3>
                    <p className="text-white/80 text-sm sm:text-base">{card.description}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Features */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-16"
        >
          {[
            { icon: '🔒', title: 'Immutable', description: 'Stored on Algorand blockchain. Cannot be altered or deleted.' },
            { icon: '⚡', title: 'Instant', description: '3.3-second finality. Verify in seconds, not days.' },
            { icon: '🌐', title: 'Decentralized', description: 'No server to go down. Your credentials are always accessible.' },
            { icon: '📱', title: 'Wallet-Based', description: 'Credentials live in your Algo wallet. You control them.' },
          ].map((feature, idx) => (
            <motion.div key={idx} whileHover={{ y: -2 }} className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
              <p className="text-white/75 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.section>

        <footer className="text-center text-white/50 text-sm">
          Built on Algorand • Credentials as ARC-3 NFTs • No middleman, no database
        </footer>
      </div>
    </div>
  )
}
