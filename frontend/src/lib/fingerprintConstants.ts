export const MAX_FINGERPRINTS_PER_EMPLOYEE = 3

export const SLOT_LABELS: Record<number, string> = {
  0: 'Finger 1',
  1: 'Finger 2',
  2: 'Finger 3',
}

export type DeviceSyncStatus = {
  deviceId: number
  deviceName: string
  enrolled: boolean
  enrolledAt?: string
  isActive: boolean
  syncEnabled: boolean
}

export type FingerprintSlot = {
  slot: number
  label: string
  fingerIndex: number | null
  enrolled: boolean
  devices: DeviceSyncStatus[]
}
