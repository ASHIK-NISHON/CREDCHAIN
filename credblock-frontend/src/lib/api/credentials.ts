import { apiClient } from './client'
import algosdk from 'algosdk'
import { mintCredentialNFT } from '../algorand/nft'
import { uploadFileToIPFS, uploadMetadataToIPFS, saveCredential } from './ipfs'

export interface IssueCredentialParams {
  issuerAddress: string
  studentAddress: string
  studentName: string
  title: string
  description?: string
  issueDate: string
  expiryDate?: string
  certificateFile: string
  certificateFileName: string
}

export interface IssueCredentialResult {
  assetId: string
  transactionHash: string
  certificateIpfsUrl: string
  metadataIpfsUrl: string
  progress: string[]
}

export type ProgressCallback = (step: string) => void

function createARC3Metadata(params: {
  name: string
  description: string
  certificateIpfsUrl: string
  studentName: string
  issuerAddress: string
  issueDate: string
  expiryDate?: string
}): object {
  return {
    name: params.name,
    description: params.description,
    image: params.certificateIpfsUrl,
    external_url: `https://credchain.app/verify/${params.issuerAddress}`,
    attributes: [
      { trait_type: 'student_name', value: params.studentName },
      { trait_type: 'issuer', value: params.issuerAddress },
      { trait_type: 'issue_date', value: params.issueDate },
      ...(params.expiryDate ? [{ trait_type: 'expiry_date', value: params.expiryDate }] : []),
    ],
  }
}

export async function issueCredential(
  params: IssueCredentialParams,
  transactionSigner: algosdk.TransactionSigner,
  onProgress?: ProgressCallback,
): Promise<IssueCredentialResult> {
  const progress: string[] = []

  const updateProgress = (step: string) => {
    progress.push(step)
    onProgress?.(step)
  }

  try {
    updateProgress('Uploading certificate to IPFS...')
    const certificateUpload = await uploadFileToIPFS(params.certificateFile, params.certificateFileName)
    updateProgress(`Certificate uploaded`)

    updateProgress('Generating ARC-3 metadata...')
    const metadata = createARC3Metadata({
      name: params.title,
      description: params.description || `Credential issued to ${params.studentName}`,
      certificateIpfsUrl: certificateUpload.ipfsUrl,
      studentName: params.studentName,
      issuerAddress: params.issuerAddress,
      issueDate: params.issueDate,
      expiryDate: params.expiryDate,
    })

    updateProgress('Uploading metadata to IPFS...')
    const metadataUpload = await uploadMetadataToIPFS(metadata, `metadata-${params.title}.json`)
    updateProgress(`Metadata uploaded`)

    updateProgress('Minting NFT...')
    updateProgress('📱 Please open your wallet and approve the transaction')
    const mintResult = await mintCredentialNFT(
      {
        issuerAddress: params.issuerAddress,
        studentAddress: params.studentAddress,
        assetName: params.title,
        unitName: params.title.substring(0, 8).toUpperCase(),
        metadataUrl: metadataUpload.ipfsUrl,
      },
      transactionSigner,
    )
    updateProgress(`NFT minted successfully!`)

    updateProgress('Saving to database...')
    await saveCredential({
      issuerAddress: params.issuerAddress,
      studentAddress: params.studentAddress,
      studentName: params.studentName,
      title: params.title,
      description: params.description,
      issueDate: params.issueDate,
      expiryDate: params.expiryDate,
      certificateFile: params.certificateFile,
      certificateFileName: params.certificateFileName,
      assetId: mintResult.assetId.toString(),
      txId: mintResult.txId,
      certificateIpfsUrl: certificateUpload.ipfsUrl,
      metadataIpfsUrl: metadataUpload.ipfsUrl,
    })
    updateProgress('Credential saved!')

    return {
      assetId: mintResult.assetId.toString(),
      transactionHash: mintResult.txId,
      certificateIpfsUrl: certificateUpload.ipfsUrl,
      metadataIpfsUrl: metadataUpload.ipfsUrl,
      progress,
    }
  } catch (error) {
    updateProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}