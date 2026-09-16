function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function randomBytes(length: number): BufferSource {
  return crypto.getRandomValues(new Uint8Array(length)) as BufferSource
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

// Extension và passkey là thứ gắn với từng máy, không phải với phiên đăng nhập — nên trạng thái
// "tài khoản này đã cài ví trên máy này" nằm ở localStorage. Nhờ vậy đăng xuất rồi đăng nhập lại
// chỉ phải mở khoá bằng passkey, không phải cài lại ví từ đầu. passkeyId là null khi người dùng
// bỏ qua bước passkey vì máy không có thiết bị xác thực.
const WALLET_KEY_PREFIX = 'vaulta:wallet:'

export interface DeviceWallet {
  passkeyId: string | null
}

export const walletStore = {
  get(email: string): DeviceWallet | null {
    try {
      const raw = localStorage.getItem(WALLET_KEY_PREFIX + email)
      return raw ? (JSON.parse(raw) as DeviceWallet) : null
    } catch {
      return null
    }
  },

  save(email: string, passkeyId: string | null): void {
    try {
      localStorage.setItem(WALLET_KEY_PREFIX + email, JSON.stringify({ passkeyId }))
    } catch {
      // Tab ẩn danh chặn localStorage: coi như máy này chưa cài ví, người dùng cài lại là xong.
    }
  },

  clearAll(): void {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(WALLET_KEY_PREFIX))
        .forEach((key) => localStorage.removeItem(key))
    } catch {
      // Không đọc được localStorage thì cũng chẳng có gì để xoá.
    }
  },
}

const EXTENSION_README = `Vaulta Wallet — bản demo

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
  link.download = 'vaulta-wallet-extension.txt'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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

  async createPasskey(displayName: string, signal?: AbortSignal): Promise<string> {
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
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
      timeout: 30000,
      attestation: 'none',
    }

    const credential = await navigator.credentials.create({ publicKey, signal })
    if (!credential) {
      throw new Error('Không tạo được passkey.')
    }
    return toBase64Url((credential as PublicKeyCredential).rawId)
  },

  async unlockWithPasskey(passkeyId: string, signal?: AbortSignal): Promise<void> {
    if (!window.PublicKeyCredential) {
      throw new Error('Trình duyệt này không hỗ trợ passkey (WebAuthn).')
    }

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: fromBase64Url(passkeyId) }],
      userVerification: 'preferred',
      timeout: 30000,
    }

    const assertion = await navigator.credentials.get({ publicKey, signal })
    if (!assertion) {
      throw new Error('Không mở được ví bằng passkey.')
    }
  },
}
