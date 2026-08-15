import { apiClient } from './client'

export interface VerificationResult {
  status: 'VERIFIED' | 'INVALID' | 'REVOKED'
  assetId: string
  credential?: {
    studentName: string
    studentAddress?: string
    title: string
    description?: string
    issueDate: string
    expiryDate?: string
    issuerAddress: string
    certificateIpfsUrl: string
    metadataIpfsUrl: string
    transactionHash: string
  }
  assetInfo?: Record<string, unknown>
  ownerAddress?: string
  revocationInfo?: {
    revoked: boolean
    revokedAt?: string
    reason?: string
  }
  error?: string
  rejected?: boolean
  rejectedAt?: string
  transferRequested?: boolean
}

export async function verifyCredential(assetId: string): Promise<VerificationResult> {
  const response = await apiClient.get<VerificationResult>(`/api/agents/verify/${assetId}`)
  return response.data
}

export interface ShareResult {
  qrCodeDataUrl: string
  verificationUrl: string
  assetId: string
}

export async function generateShareQR(assetId: string): Promise<ShareResult> {
  const response = await apiClient.post<ShareResult>('/api/agents/share', { assetId })
  return response.data
}

export async function transferCredentialToStudent(assetId: string, studentAddress: string): Promise<{ txId: string }> {
  const response = await apiClient.post<{ txId: string }>(`/api/agents/credentials/${assetId}/transfer`, { studentAddress })
  return response.data
}

export interface CredentialInfo {
  id: string
  assetId: string
  title: string
  studentName: string
  studentAddress: string
  issueDate: string
  issuerAddress: string
  transferred: boolean
  transferRequested: boolean
  createdAt: string
  rejected?: boolean
  rejectedAt?: string
  rejectReason?: string
}

export async function getCredentialsByAssetIds(assetIds: string[]): Promise<CredentialInfo[]> {
  if (assetIds.length === 0) return []
  const response = await apiClient.get<CredentialInfo[]>(`/api/agents/credentials?assetIds=${assetIds.join(',')}`)
  return response.data
}

/** Get credentials issued to a student address (for "To Claim" section) */
export async function getCredentialsForStudent(studentAddress: string): Promise<CredentialInfo[]> {
  const response = await apiClient.get<CredentialInfo[]>(`/api/agents/credentials?studentAddress=${encodeURIComponent(studentAddress)}`)
  return response.data
}

/** Get credentials issued by an issuer address (for issuer history) */
export async function getCredentialsForIssuer(issuerAddress: string): Promise<CredentialInfo[]> {
  const response = await apiClient.get<CredentialInfo[]>(`/api/agents/credentials?issuerAddress=${encodeURIComponent(issuerAddress)}`)
  return response.data
}

export async function requestTransfer(
  assetId: string,
  studentAddress: string,
): Promise<{ success: boolean; message: string; issuerAddress: string }> {
  const response = await apiClient.post(`/api/agents/credentials/${assetId}/request-transfer`, { studentAddress })
  return response.data
}

export async function resetTransfer(assetId: string, studentAddress: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post(`/api/agents/credentials/${assetId}/reset-transfer`, { studentAddress })
  return response.data
}

export interface PendingCredential {
  id: string
  assetId: string
  studentAddress: string
  studentName: string
  title: string
  transferRequested: boolean
}

export async function getPendingTransfers(issuerAddress: string): Promise<PendingCredential[]> {
  const response = await apiClient.get<PendingCredential[]>(`/api/agents/transfers/pending?issuerAddress=${issuerAddress}`)
  return response.data
}

export interface IssuerNotificationCounts {
  pendingCount: number
  declinedCount: number
}

export async function getIssuerNotificationCounts(issuerAddress: string, lastViewed?: string | null): Promise<IssuerNotificationCounts> {
  const params = new URLSearchParams({ issuerAddress })
  if (lastViewed) params.append('lastViewed', lastViewed)
  const response = await apiClient.get<IssuerNotificationCounts>(`/api/agents/notifications/issuer?${params.toString()}`)
  return response.data
}

export interface StudentNotificationCounts {
  claimsCount: number
}

export async function getStudentNotificationCounts(studentAddress: string, lastViewed?: string | null): Promise<StudentNotificationCounts> {
  const params = new URLSearchParams({ studentAddress })
  if (lastViewed) params.append('lastViewed', lastViewed)
  const response = await apiClient.get<StudentNotificationCounts>(`/api/agents/notifications/student?${params.toString()}`)
  return response.data
}

export async function completeTransfer(assetId: string, txId: string): Promise<{ success: boolean }> {
  const response = await apiClient.post(`/api/agents/credentials/${assetId}/complete-transfer`, { txId })
  return response.data
}

export async function rejectCredential(
  assetId: string,
  studentAddress: string,
  reason?: string,
): Promise<{ success: boolean; message: string; issuerAddress: string }> {
  const response = await apiClient.post(`/api/agents/credentials/${assetId}/reject`, { studentAddress, reason })
  return response.data
}

export interface RejectedCredential {
  id: string
  assetId: string
  studentAddress: string
  studentName: string
  title: string
  issueDate: string
  issuerAddress: string
  rejected: boolean
  rejectedAt: string
  rejectReason: string | null
  removedFromWallet: boolean
  removedFromWalletAt: string | null
  burned: boolean
  burnedAt: string | null
}

export async function getRejectedCredentials(issuerAddress: string): Promise<RejectedCredential[]> {
  const response = await apiClient.get<RejectedCredential[]>(`/api/agents/transfers/rejected?issuerAddress=${issuerAddress}`)
  return response.data
}

export async function markCredentialRemoved(assetId: string, studentAddress: string): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>(`/api/agents/credentials/${assetId}/removed`, { studentAddress })
  return response.data
}

export async function burnCredential(assetId: string, issuerAddress: string): Promise<{ success: boolean; txId: string }> {
  const response = await apiClient.post<{ success: boolean; txId: string }>(`/api/agents/credentials/${assetId}/burn`, { issuerAddress })
  return response.data
}
