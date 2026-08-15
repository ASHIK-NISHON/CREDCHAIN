import { motion } from 'framer-motion'

interface StatusBannerProps {
  status: 'VERIFIED' | 'INVALID' | 'REVOKED'
}

export default function StatusBanner({ status }: StatusBannerProps) {
  const config = {
    VERIFIED: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-300',
      icon: '✓',
      message: 'Credential Verified',
      sub: 'This credential has been verified on the blockchain.',
    },
    INVALID: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-300',
      icon: '✕',
      message: 'Credential Invalid',
      sub: 'This credential could not be verified.',
    },
    REVOKED: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-300',
      icon: '!',
      message: 'Credential Revoked',
      sub: 'This credential has been revoked.',
    },
  }

  const { bg, border, text, icon, message, sub } = config[status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${bg} border ${border} rounded-xl p-5`}
    >
      <div className="flex items-center gap-4">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
          className={`flex h-10 w-10 items-center justify-center rounded-xl font-display text-lg font-bold ${text} ${
            status === 'VERIFIED' ? 'bg-emerald-500/15' : status === 'INVALID' ? 'bg-red-500/15' : 'bg-amber-500/15'
          }`}
        >
          {icon}
        </motion.span>
        <div>
          <h3 className={`font-display font-bold text-lg ${text}`}>{message}</h3>
          <p className={`text-sm ${text} opacity-90`}>{sub}</p>
        </div>
      </div>
    </motion.div>
  )
}
