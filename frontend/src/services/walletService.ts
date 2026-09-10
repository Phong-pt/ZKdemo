function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function randomBytes(length: number): BufferSource {
  return crypto.getRandomValues(new Uint8Array(length)) as BufferSource
}

export const walletService = {
  async installExtension(onProgress: (pct: number) => void): Promise<void> {
    let pct = 0
    onProgress(0)
    while (pct < 100) {
      await delay(160)
      pct = Math.min(100, pct + 7 + Math.random() * 9)
      onProgress(pct)
    }
  },

  async createPasskey(displayName: string): Promise<void> {
    if (!window.PublicKeyCredential) {
      throw new Error('Trình duyệt này không hỗ trợ passkey (WebAuthn).')
    }

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: randomBytes(32),
      rp: { name: 'Vaulta Wallet' },
      user: {
        id: randomBytes(16),
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    }

    const credential = await navigator.credentials.create({ publicKey })
    if (!credential) {
      throw new Error('Không tạo được passkey.')
    }
  },
}
