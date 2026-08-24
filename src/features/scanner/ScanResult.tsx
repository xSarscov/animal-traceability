import { Link } from 'react-router'
import type { ReactNode } from 'react'

import type { MicrochipLookupResult } from './microchip-lookup'

type ScanResultProps = {
  result: Exclude<MicrochipLookupResult, { kind: 'implanted' }>
}

export function ScanResult({ result }: ScanResultProps) {
  if (result.kind === 'unknown') {
    return <ResultPanel code={result.code} title="Microchip no reconocido" />
  }

  if (result.kind === 'blocked') {
    return (
      <ResultPanel code={result.code} title="Microchip bloqueado">
        <p className="mt-2 text-sm text-stone-700">Este identificador está inhabilitado y no puede usarse para registrar un animal.</p>
      </ResultPanel>
    )
  }

  return (
    <ResultPanel code={result.code} title="Microchip disponible">
      <Link
        className="mt-4 inline-flex rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        to={`/animals/new?chip=${encodeURIComponent(result.code)}`}
      >
        Registrar animal
      </Link>
    </ResultPanel>
  )
}

function ResultPanel({ children, code, title }: { children?: ReactNode; code: string; title: string }) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5" aria-live="polite">
      <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
      <p className="mt-1 font-mono text-sm text-stone-700">{code}</p>
      {children}
    </section>
  )
}
