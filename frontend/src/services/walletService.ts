import {
  apiClient,
  setWalletUnlock,
  type PasskeyCreationOptions,
  type PasskeyRequestOptions,
} from './apiClient'

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = ''
  new Uint8Array(buffer).forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Cấp phát ArrayBuffer tường minh: Uint8Array.from() trả về Uint8Array<ArrayBufferLike>, mà
// BufferSource của WebAuthn chỉ nhận ArrayBufferView<ArrayBuffer>.
function fromBase64Url(value: string): BufferSource {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const EXTENSION_README = `NX Cred — bản demo

File này thay cho gói extension thật. Bản demo chạy toàn bộ giao diện ví trên
màn hình lớn để nhiều người cùng xem được; đóng gói thành extension của trình
duyệt là việc của giai đoạn sau.

Ví giữ ba thứ, và cả ba đều không rời khỏi thiết bị người dùng trong mô hình
đầy đủ:

  link secret   bí mật gắn credential với đúng ví này. Issuer ký lên nó mà
                không nhìn thấy nó, verifier kiểm chứng nó mà cũng không nhìn
                thấy nó. Mất link secret thì credential thành vô dụng, nên
                credential bị đánh cắp cũng không dùng được ở máy khác.

  credential    chữ ký CL của issuer lên toàn bộ thuộc tính trên CCCD.

  passkey       khoá sinh trắc học mở kho lưu trữ cục bộ. Đây là lớp bảo vệ
                quyền truy cập, không phải cơ chế zero-knowledge.

Lưu ý về bản demo hiện tại: phần mật mã của ví đang chạy trên máy chủ cùng với
issuer và verifier, đổi lấy tốc độ dựng demo. Muốn đúng mô hình tự chủ danh
tính thì phần này phải được viết lại để chạy trong trình duyệt của người dùng.
`

function downloadExtensionBundle() {
  const blob = new Blob([EXTENSION_README], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'nx-cred-extension.txt'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function toCreationOptions(json: PasskeyCreationOptions): PublicKeyCredentialCreationOptions {
  return {
    ...json,
    challenge: fromBase64Url(json.challenge),
    user: { ...json.user, id: fromBase64Url(json.user.id) },
    excludeCredentials: json.excludeCredentials?.map((item) => ({
      ...item,
      id: fromBase64Url(item.id),
    })),
  } as PublicKeyCredentialCreationOptions
}

function toRequestOptions(json: PasskeyRequestOptions): PublicKeyCredentialRequestOptions {
  return {
    ...json,
    challenge: fromBase64Url(json.challenge),
    allowCredentials: json.allowCredentials?.map((item) => ({
      ...item,
      id: fromBase64Url(item.id),
    })),
  } as PublicKeyCredentialRequestOptions
}

function encodeAttestation(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: toBase64Url(response.attestationObject),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

function encodeAssertion(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      ...(response.userHandle ? { userHandle: toBase64Url(response.userHandle) } : {}),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

export const walletService = {
  async installExtension(onProgress: (pct: number) => void): Promise<void> {
    let pct = 0
    onProgress(0)
    downloadExtensionBundle()
    while (pct < 100) {
      await delay(160)
      pct = Math.min(100, pct + 7 + Math.random() * 9)
      onProgress(pct)
    }
  },

  // Máy chủ phát challenge và tự kiểm chữ ký; trình duyệt chỉ là nơi thiết bị xác thực ký lên đó.
  async createPasskey(signal?: AbortSignal): Promise<void> {
    if (!window.PublicKeyCredential) {
      throw new Error('Trình duyệt này không hỗ trợ passkey (WebAuthn).')
    }
    const options = await apiClient.passkeyRegisterOptions()
    const credential = await navigator.credentials.create({
      publicKey: toCreationOptions(options),
      signal,
    })
    if (!credential) {
      throw new Error('Không tạo được passkey.')
    }
    const result = await apiClient.passkeyRegisterVerify(encodeAttestation(credential as PublicKeyCredential))
    setWalletUnlock(result.unlock_token)
  },

  async unlockWithPasskey(signal?: AbortSignal): Promise<void> {
    if (!window.PublicKeyCredential) {
      throw new Error('Trình duyệt này không hỗ trợ passkey (WebAuthn).')
    }
    const options = await apiClient.passkeyLoginOptions()
    const assertion = await navigator.credentials.get({
      publicKey: toRequestOptions(options),
      signal,
    })
    if (!assertion) {
      throw new Error('Không mở được ví bằng passkey.')
    }
    const result = await apiClient.passkeyLoginVerify(encodeAssertion(assertion as PublicKeyCredential))
    setWalletUnlock(result.unlock_token)
  },
}
