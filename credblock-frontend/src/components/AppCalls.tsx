import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { HelloWorldFactory } from '../contracts/HelloWorld'
import { OnSchemaBreak, OnUpdate } from '@algorandfoundation/algokit-utils/types/app'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Spinner } from './ui/spinner'

interface AppCallsInterface {
  openModal: boolean
  setModalState: (value: boolean) => void
}

const AppCalls = ({ openModal, setModalState }: AppCallsInterface) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [contractInput, setContractInput] = useState<string>('')
  const { enqueueSnackbar } = useSnackbar()
  const { transactionSigner, activeAddress } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  algorand.setDefaultSigner(transactionSigner)

  const sendAppCall = async () => {
    setLoading(true)

    // Please note, in typical production scenarios,
    // you wouldn't want to use deploy directly from your frontend.
    // Instead, you would deploy your contract on your backend and reference it by id.
    // Given the simplicity of the starter contract, we are deploying it on the frontend
    // for demonstration purposes.
    const factory = new HelloWorldFactory({
      defaultSender: activeAddress ?? undefined,
      algorand,
    })
    const deployResult = await factory
      .deploy({
        onSchemaBreak: OnSchemaBreak.AppendApp,
        onUpdate: OnUpdate.AppendApp,
      })
      .catch((e: Error) => {
        enqueueSnackbar(`Error deploying the contract: ${e.message}`, { variant: 'error' })
        setLoading(false)
        return undefined
      })

    if (!deployResult) {
      return
    }

    const { appClient } = deployResult

    const response = await appClient.send.hello({ args: { name: contractInput } }).catch((e: Error) => {
      enqueueSnackbar(`Error calling the contract: ${e.message}`, { variant: 'error' })
      setLoading(false)
      return undefined
    })

    if (!response) {
      return
    }

    enqueueSnackbar(`Response from the contract: ${response.return}`, { variant: 'success' })
    setLoading(false)
  }

  return (
    <Dialog open={openModal} onOpenChange={(open) => setModalState(open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Say hello to your Algorand smart contract</DialogTitle>
        </DialogHeader>

        <Input
          type="text"
          placeholder="Provide input to hello function"
          value={contractInput}
          onChange={(e) => {
            setContractInput(e.target.value)
          }}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setModalState(false)}>
            Close
          </Button>
          <Button onClick={sendAppCall} disabled={loading}>
            {loading ? (
              <>
                <Spinner />
                Sending…
              </>
            ) : (
              'Send application call'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AppCalls
