import { apiClient } from './client'

export interface UploadToIPFSResult {
  ipfsHash: string
  ipfsUrl: string
}

export async function uploadFileToIPFS(file: string, fileName: string): Promise<UploadToIPFSResult> {
  const response = await apiClient.post<UploadToIPFSResult>('/api/ipfs/upload', { file, fileName })
  return response.data
}

export async function uploadMetadataToIPFS(metadata: object, fileName: string): Promise<UploadToIPFSResult> {
  const response = await apiClient.post<UploadToIPFSResult>('/api/ipfs/metadata', { metadata, fileName })
  return response.data
}

export interface SaveCredentialParams {
  issuerAddress: string
  studentAddress: string
  studentName: string
  title: string
  description?: string
  issueDate: string
  expiryDate?: string
  certificateFile: string
  certificateFileName: string
  assetId: string
  txId: string
  certificateIpfsUrl: string
  metadataIpfsUrl: string
}

export interface SaveCredentialResult {
  id: string
  assetId: string
  txId: string
}

export async function saveCredential(params: SaveCredentialParams): Promise<SaveCredentialResult> {
  const response = await apiClient.post<SaveCredentialResult>('/api/credentials/save', params)
  return response.data
}
