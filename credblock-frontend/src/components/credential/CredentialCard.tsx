import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { generateShareQR } from '../../lib/api/verification'
import { optOutOfAsset } from '../../lib/algorand/nft'
import QRCodeModal from '../ui/QRCodeModal'
import { Button } from '../ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Spinner } from '../ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'

interface CredentialCardProps {
  assetId: string
  title: string
  studentName: string
  issueDate: string
  issuerAddress: string
  onDelete?: () => void
}

export default function CredentialCard({ assetId, title, studentName, issueDate, issuerAddress, onDelete }: CredentialCardProps) {
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  const [showQR, setShowQR] = useState(false)
  const [qrData, setQrData] = useState<string>('')
  const [loadingQR, setLoadingQR] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleShare = async () => {
    setLoadingQR(true)
    try {
      const result = await generateShareQR(assetId)
      setQrData(result.qrCodeDataUrl)
      setShowQR(true)
    } catch {
      enqueueSnackbar('Failed to generate QR code', { variant: 'error' })
    } finally {
      setLoadingQR(false)
    }
  }

  const handleDelete = async () => {
    if (!activeAddress || !transactionSigner) {
      enqueueSnackbar('Please connect your wallet', { variant: 'warning' })
      return
    }

    setDeleting(true)
    try {
      const receiver = issuerAddress && issuerAddress.length > 0 ? issuerAddress : activeAddress
      await optOutOfAsset(assetId, activeAddress, transactionSigner, receiver)

      enqueueSnackbar('Credential transferred back to issuer', { variant: 'success' })
      setShowDeleteDialog(false)

      await new Promise((resolve) => setTimeout(resolve, 4000))

      if (onDelete) {
        onDelete()
      } else {
        window.location.reload()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove credential'
      enqueueSnackbar(message, { variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }} className="h-full">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="font-display">{title}</CardTitle>
            <div className="text-sm text-muted-foreground">
              <div>Issued to: {studentName}</div>
              <div>{new Date(issueDate).toLocaleDateString()}</div>
            </div>
          </CardHeader>
          <CardContent className="pt-0" />
          <CardFooter className="gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to={`/verify/${assetId}`}>View</Link>
            </Button>
            <Button onClick={handleShare} disabled={loadingQR} className="flex-1">
              {loadingQR ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Generating…
                </>
              ) : (
                'Share'
              )}
            </Button>
            <Button onClick={() => setShowDeleteDialog(true)} variant="destructive" size="icon" title="Remove from wallet">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </Button>
          </CardFooter>
        </Card>
      </motion.div>

      {showQR && (
        <QRCodeModal qrData={qrData} verificationUrl={`${window.location.origin}/verify/${assetId}`} onClose={() => setShowQR(false)} />
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Credential</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this credential from your wallet? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Credential:</strong> {title}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>What happens:</strong>
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>This credential will be removed from your wallet</li>
              <li>It will no longer appear in your credentials list</li>
              <li>The credential still exists on the blockchain</li>
              <li>You can receive it again if the issuer transfers it</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Spinner className="h-4 w-4" /> : 'Remove from Wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
