import { useCallback, useEffect, useState } from 'react'
import { addressUrl, readContractUrl } from '@/lib/explorer'
import { apiClient, type RegistrySchemasResponse } from '@/services/apiClient'

export function Step4Issuers() {
  const [registry, setRegistry] = useState<RegistrySchemasResponse | null>(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try {
      setRegistry(await apiClient.registrySchemas())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được registry blockchain')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 20_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return (
    <div>
      <div className="text-[26px] font-medium tracking-[-0.03em]">Schemas from blockchain</div>

      {error && <div role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
      {!registry && !error && <div className="mt-5 text-sm text-ink-4">Reading schemas from chain…</div>}
      {registry && (
        <>
          <div className="mt-5 text-xs text-ink-4">
            {registry.chain} · chain {registry.chain_id} · registry{' '}
            <a
              className="font-mono text-blue"
              target="_blank"
              rel="noreferrer"
              href={addressUrl(registry.registry_address)}
            >
              {registry.registry_address} ↗
            </a>
          </div>
          {registry.schemas.length === 0 && <div className="mt-4 text-sm text-ink-4">No schema has been registered yet.</div>}
          <div className="mt-4 space-y-3">
            {registry.schemas.map((schema) => (
              <div key={schema.id} className="border border-line-2 rounded-[18px] p-5 bg-bg-sunken">
                <div className="flex justify-between gap-3 flex-wrap">
                  <div className="font-medium">{schema.name} <span className="text-ink-4">/ {schema.version}</span></div>
                  <div className={`text-[13px] ${schema.credential_definitions.length ? 'text-green' : 'text-amber-700'}`}>
                    {schema.credential_definitions.length ? 'Schema and issuer key registered ✓' : 'Schema registered · issuer key missing'}
                  </div>
                </div>
                <div className="text-xs text-ink-3 mt-2">
                  Issuer{' '}
                  <a
                    className="font-mono text-blue break-all"
                    target="_blank"
                    rel="noreferrer"
                    href={addressUrl(schema.issuer)}
                  >
                    {schema.issuer} ↗
                  </a>
                </div>
                <div className="text-xs text-ink-3 mt-2">
                  Schema ID{' '}
                  <a
                    className="font-mono text-blue break-all"
                    target="_blank"
                    rel="noreferrer"
                    href={readContractUrl(registry.registry_address)}
                  >
                    {schema.id} ↗
                  </a>
                </div>
                <div className="text-xs text-ink-3 mt-2">Fingerprint <span className="font-mono break-all">{schema.fingerprint}</span></div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {schema.attributes.map((attribute) => <span key={attribute} className="rounded-md border border-line bg-white px-2 py-1 text-xs font-mono">{attribute}</span>)}
                </div>
                {schema.credential_definitions.map((credDef) => (
                  <div key={credDef.id} className="text-xs text-ink-4 mt-3">
                    Credential definition{' '}
                    <a
                      className="font-mono text-blue break-all"
                      target="_blank"
                      rel="noreferrer"
                      href={readContractUrl(registry.registry_address)}
                    >
                      {credDef.id} ↗
                    </a>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
