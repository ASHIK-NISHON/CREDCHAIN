import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getIssuerNotificationCounts, getStudentNotificationCounts } from '../../lib/api/verification'

interface NotificationState {
  pendingLastViewed: string | null
  declinedLastViewed: string | null
  claimsLastViewed: string | null
  pendingCount: number
  declinedCount: number
  claimsCount: number
  setPendingLastViewed: (date: string) => void
  setDeclinedLastViewed: (date: string) => void
  setClaimsLastViewed: (date: string) => void
  setPendingCount: (count: number) => void
  setDeclinedCount: (count: number) => void
  setClaimsCount: (count: number) => void
  resetPendingCount: () => void
  resetDeclinedCount: () => void
  resetClaimsCount: () => void
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      pendingLastViewed: null,
      declinedLastViewed: null,
      claimsLastViewed: null,
      pendingCount: 0,
      declinedCount: 0,
      claimsCount: 0,

      setPendingLastViewed: (date: string) => set({ pendingLastViewed: date }),
      setDeclinedLastViewed: (date: string) => set({ declinedLastViewed: date }),
      setClaimsLastViewed: (date: string) => set({ claimsLastViewed: date }),
      setPendingCount: (count: number) => set({ pendingCount: count }),
      setDeclinedCount: (count: number) => set({ declinedCount: count }),
      setClaimsCount: (count: number) => set({ claimsCount: count }),
      resetPendingCount: () => set({ pendingCount: 0 }),
      resetDeclinedCount: () => set({ declinedCount: 0 }),
      resetClaimsCount: () => set({ claimsCount: 0 }),
    }),
    {
      name: 'credchain-notifications',
    },
  ),
)

export async function fetchIssuerNotificationCounts(
  address: string,
  lastViewed: string | null,
): Promise<{ pendingCount: number; declinedCount: number }> {
  try {
    return await getIssuerNotificationCounts(address, lastViewed)
  } catch (error) {
    console.error('Failed to fetch issuer notification counts:', error)
    return { pendingCount: 0, declinedCount: 0 }
  }
}

export async function fetchStudentNotificationCounts(address: string, lastViewed: string | null): Promise<{ claimsCount: number }> {
  try {
    return await getStudentNotificationCounts(address, lastViewed)
  } catch (error) {
    console.error('Failed to fetch student notification counts:', error)
    return { claimsCount: 0 }
  }
}
