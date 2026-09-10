import { Navigate, Route, Routes } from 'react-router-dom'
import { WalletApp } from '@/apps/wallet/WalletApp'
import { MobileCaptureApp } from '@/apps/wallet/MobileCaptureApp'
import { VerifierApp } from '@/apps/verifier/VerifierApp'

function App() {
  return (
    <Routes>
      <Route path="/" element={<WalletApp />} />
      <Route path="/mobile-capture" element={<MobileCaptureApp />} />
      <Route path="/verifier" element={<VerifierApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
