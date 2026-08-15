import { useWallet, Wallet, WalletId } from '@txnlab/use-wallet-react'
import Account from './Account'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Separator } from './ui/separator'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { wallets, activeAddress } = useWallet()

  const isKmd = (wallet: Wallet) => wallet.id === WalletId.KMD

  return (
    <Dialog open={openModal} onOpenChange={(open) => (open ? null : closeModal())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select wallet provider</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {activeAddress && (
            <>
              <Account />
              <Separator />
            </>
          )}

          {!activeAddress && (
            <div className="grid gap-2">
              {wallets?.map((wallet) => (
                <Button
                  data-test-id={`${wallet.id}-connect`}
                  variant="outline"
                  className="h-auto justify-start gap-3 px-3 py-3"
                  key={`provider-${wallet.id}`}
                  onClick={() => wallet.connect()}
                >
                  {!isKmd(wallet) && (
                    <img
                      alt={`wallet_icon_${wallet.id}`}
                      src={wallet.metadata.icon}
                      className="h-8 w-8 rounded-lg"
                      style={{ objectFit: 'contain' }}
                    />
                  )}
                  <span>{isKmd(wallet) ? 'LocalNet Wallet' : wallet.metadata.name}</span>
                </Button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button data-test-id="close-wallet-modal" variant="ghost" onClick={closeModal}>
            Close
          </Button>
          {activeAddress && (
            <Button
              variant="destructive"
              data-test-id="logout"
              onClick={async () => {
                if (wallets) {
                  const activeWallet = wallets.find((w) => w.isActive)
                  if (activeWallet) {
                    await activeWallet.disconnect()
                  } else {
                    localStorage.removeItem('@txnlab/use-wallet:v3')
                    window.location.reload()
                  }
                }
              }}
            >
              Logout
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
export default ConnectWallet
