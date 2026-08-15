import { useState } from 'react'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'

interface QRCodeModalProps {
  qrData: string
  verificationUrl: string
  onClose: () => void
}

export default function QRCodeModal({ qrData, verificationUrl, onClose }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = qrData
    link.download = 'credential-qr.png'
    link.click()
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Failed to copy link')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Share Credential</DialogTitle>
          <DialogDescription>Scan or share the link below.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <img src={qrData} alt="QR Code" className="h-56 w-56" />
          </div>
          <p className="max-w-xs break-all text-center text-sm text-muted-foreground">{verificationUrl}</p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
          <Button variant="outline" onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            Download QR
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
