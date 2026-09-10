import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export interface QrCodeProps {
  value: string
  size: number
}

export function QrCode({ value, size }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: '#16171A', light: '#FFFFFF' } }).then(
      (url) => {
        if (!cancelled) setDataUrl(url)
      },
    )
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="bg-bg-muted animate-pulse rounded-lg" />
  }
  return <img src={dataUrl} width={size} height={size} alt="QR code" />
}
