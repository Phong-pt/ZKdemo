import { Navigate, Route, Routes } from 'react-router-dom'
import { WalletApp } from '@/apps/wallet/WalletApp'
import { MobileCaptureApp } from '@/apps/wallet/MobileCaptureApp'
import { PresentationApp } from '@/apps/wallet/PresentationApp'
import { VerifierApp } from '@/apps/verifier/VerifierApp'
import { IssuerApp } from '@/apps/issuer/IssuerApp'

function App() {
  return (
    <Routes>
      <Route path="/" element={<WalletApp />} />
      <Route path="/mobile-capture" element={<MobileCaptureApp />} />
      <Route path="/present/:sessionId" element={<PresentationApp />} />
      <Route path="/verifier" element={<VerifierApp />} />
      <Route path="/issuer" element={<IssuerApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
