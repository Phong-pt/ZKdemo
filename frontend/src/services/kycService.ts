import { apiClient, type IdentityAttributes } from './apiClient'

export interface VerifiedIdentity {
  name: string
  dob: string
  nationality: string
  document: string
}

const PROCESSING_STEP_TIMES_MS = [900, 1900, 2900, 3900]
const MIN_PROCESSING_MS = 4800

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export const kycService = {
  async runProcessing(identity: IdentityAttributes, onStep: (step: number) => void): Promise<VerifiedIdentity> {
    const timers = PROCESSING_STEP_TIMES_MS.map((ms, i) => setTimeout(() => onStep(i + 1), ms))
    try {
      const [result] = await Promise.all([apiClient.issueCredential(identity), delay(MIN_PROCESSING_MS)])
      return {
        name: result.identity.name,
        dob: result.identity.dob,
        nationality: result.identity.nationality,
        document: 'National ID (CCCD)',
      }
    } finally {
      timers.forEach(clearTimeout)
    }
  },
}
