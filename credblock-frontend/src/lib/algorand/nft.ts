import algosdk from 'algosdk'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { getAlgodConfigFromViteEnvironment } from '../../utils/network/getAlgoClientConfigs'

export interface MintCredentialParams {
  issuerAddress: string
  studentAddress: string
  assetName: string
  unitName: string
  metadataUrl: string
}

export interface MintCredentialResult {
  assetId: bigint
  txId: string
}

export async function mintCredentialNFT(
  params: MintCredentialParams,
  transactionSigner: algosdk.TransactionSigner,
): Promise<MintCredentialResult> {
  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({ algodConfig })

  const createResult = await algorand.send.assetCreate({
    sender: params.issuerAddress,
    signer: transactionSigner,
    total: 1n,
    decimals: 0,
    assetName: params.assetName,
    unitName: params.unitName,
    url: params.metadataUrl,
    manager: params.issuerAddress,
    reserve: params.issuerAddress,
    freeze: params.issuerAddress,
    clawback: params.issuerAddress,
  })

  return { assetId: createResult.confirmation.assetIndex!, txId: createResult.txIds[0] }
}

export async function optInAndReceiveAsset(
  assetId: string,
  signerAddress: string,
  transactionSigner: algosdk.TransactionSigner,
): Promise<{ optedIn: boolean; received: boolean }> {
  const algorand = AlgorandClient.fromConfig({
    algodConfig: getAlgodConfigFromViteEnvironment(),
  })

  await algorand.send.assetOptIn({
    sender: signerAddress,
    signer: transactionSigner,
    assetId: BigInt(assetId),
  })

  return { optedIn: true, received: true }
}

export async function optOutOfAsset(
  assetId: string,
  signerAddress: string,
  transactionSigner: algosdk.TransactionSigner,
  issuerAddress: string,
): Promise<{ optedOut: boolean; txId: string }> {
  const algorand = AlgorandClient.fromConfig({
    algodConfig: getAlgodConfigFromViteEnvironment(),
  })

  const result = await algorand.send.assetTransfer({
    sender: signerAddress,
    signer: transactionSigner,
    receiver: issuerAddress,
    assetId: BigInt(assetId),
    amount: 1n,
  })

  return { optedOut: true, txId: result.txIds[0] }
}

export async function burnAsset(
  assetId: string,
  signerAddress: string,
  transactionSigner: algosdk.TransactionSigner,
): Promise<{ burned: boolean; txId: string }> {
  const algorand = AlgorandClient.fromConfig({
    algodConfig: getAlgodConfigFromViteEnvironment(),
  })

  algorand.setSigner(signerAddress, transactionSigner)

  const result = await algorand.send.assetDestroy({
    sender: signerAddress,
    assetId: BigInt(assetId),
    note: new TextEncoder().encode(`Burn credential asset ${assetId}`),
  })

  return { burned: true, txId: result.txIds[0] }
}
