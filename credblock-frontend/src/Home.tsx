// src/components/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import Transact from './components/Transact'
import AppCalls from './components/AppCalls'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Separator } from './components/ui/separator'

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [openDemoModal, setOpenDemoModal] = useState<boolean>(false)
  const [appCallsDemoModal, setAppCallsDemoModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  const toggleDemoModal = () => {
    setOpenDemoModal(!openDemoModal)
  }

  const toggleAppCallsModal = () => {
    setAppCallsDemoModal(!appCallsDemoModal)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This starter has been generated using the official AlgoKit React template. Refer to the resource below for next steps.
          </p>

          <div className="grid gap-2">
            <Button asChild variant="secondary">
              <a data-test-id="getting-started" target="_blank" rel="noreferrer" href="https://github.com/algorandfoundation/algokit-cli">
                Getting started
              </a>
            </Button>

            <Separator />

            <Button data-test-id="connect-wallet" variant="outline" onClick={toggleWalletModal}>
              Wallet Connection
            </Button>

            {activeAddress && (
              <Button data-test-id="transactions-demo" variant="outline" onClick={toggleDemoModal}>
                Transactions Demo
              </Button>
            )}

            {activeAddress && (
              <Button data-test-id="appcalls-demo" variant="outline" onClick={toggleAppCallsModal}>
                Contract Interactions Demo
              </Button>
            )}
          </div>

          <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
          <Transact openModal={openDemoModal} setModalState={setOpenDemoModal} />
          <AppCalls openModal={appCallsDemoModal} setModalState={setAppCallsDemoModal} />
        </CardContent>
      </Card>
    </div>
  )
}

export default Home
