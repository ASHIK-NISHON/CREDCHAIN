import { apiClient } from './client'

export interface RegisterResult {
  address: string
  challenge: string
  message: string
}

export interface VerifyResult {
  success: boolean
  address: string
  isVerified: boolean
  name?: string
}

export interface IssuerCheck {
  isIssuer: boolean
  isVerified: boolean
}

export interface IssuerProfile {
  address: string
  name: string | null
  isVerified: boolean
  registeredAt: string | null
  credentialCount: number
}

export async function registerIssuer(address: string): Promise<RegisterResult> {
  const response = await apiClient.post<RegisterResult>('/api/issuers/register', { address })
  return response.data
}

export async function verifyIssuer(address: string, signature: string, name?: string): Promise<VerifyResult> {
  const response = await apiClient.post<VerifyResult>('/api/issuers/verify', { address, signature, name })
  return response.data
}

export async function checkIssuer(address: string): Promise<IssuerCheck> {
  const response = await apiClient.get<IssuerCheck>(`/api/issuers/check/${address}`)
  return response.data
}

export async function getIssuerProfile(address: string): Promise<IssuerProfile> {
  const response = await apiClient.get<IssuerProfile>(`/api/issuers/me/${address}`)
  return response.data
}
