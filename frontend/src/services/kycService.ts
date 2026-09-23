import { apiClient, type IdentityAttributes } from './apiClient'

export interface VerifiedIdentity {
  name: string
  dob: string
  nationality: string
  document: string
}

export const kycService = {
  async runProcessing(identity: IdentityAttributes, onStep: (step: number) => void, signal?: AbortSignal): Promise<VerifiedIdentity> {
    signal?.throwIfAborted()
    onStep(1)
    let request = await apiClient.submitIssuance(identity)
    const deadline = Date.now() + 16 * 60 * 1000
    while (request.status !== 'issued') {
      signal?.throwIfAborted()
      if (request.status === 'rejected') throw new Error(request.reason || 'Issuer từ chối hồ sơ')
      if (request.status === 'expired' || Date.now() > deadline) throw new Error('Yêu cầu đã hết hạn. Hãy gửi lại hồ sơ.')
      if (request.status === 'signed') {
        onStep(3)
        request = await apiClient.completeIssuance(request.id)
      } else {
        onStep(2)
        await new Promise(resolve => setTimeout(resolve, 1500))
        signal?.throwIfAborted()
        request = await apiClient.pollIssuance(request.id)
      }
    }
    if (!request.identity) throw new Error('Credential chưa có dữ liệu danh tính')
    onStep(5)
    return { name: request.identity.name, dob: request.identity.dob,
      nationality: request.identity.nationality, document: 'National ID (CCCD)' }
  },
}
