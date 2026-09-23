// Liên kết sang Etherscan Sepolia. Mục đích là để bất kỳ ai — issuer hay verifier — tự kiểm được
// dữ liệu trên chain mà không cần tin giao diện này.
const BASE = 'https://sepolia.etherscan.io'

export function addressUrl(address: string): string {
  return `${BASE}/address/${address}`
}

export function txUrl(hash: string): string {
  return `${BASE}/tx/${hash}`
}

// schemaId và credentialDefinitionId là khoá bytes32 trong storage của hợp đồng, không phải địa chỉ
// hay mã giao dịch, nên Etherscan không có trang riêng cho chúng. Trỏ sang tab Read Contract của
// chính hợp đồng: dán id vào getSchema/getCredentialDefinition là đọc lại được đúng bản ghi đó.
export function readContractUrl(contract: string): string {
  return `${BASE}/address/${contract}#readContract`
}
