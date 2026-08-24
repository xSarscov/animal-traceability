import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { normalizeMicrochipCode, validateMicrochipCode } from './microchip-code'
import { lookupMicrochipByCode, type MicrochipLookupResult } from './microchip-lookup'
import { ScanResult } from './ScanResult'
import { ScannerInput } from './ScannerInput'

type PersistentResult = Exclude<MicrochipLookupResult, { kind: 'implanted' }>

type ScanState =
  | { kind: 'idle' }
  | { kind: 'invalid'; message: string }
  | { kind: 'searching'; code: string }
  | { kind: 'result'; result: PersistentResult }
  | { kind: 'error'; code: string }

export function ScanPage() {
  const [inputValue, setInputValue] = useState('')
  const [scanState, setScanState] = useState<ScanState>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const lookupInProgressRef = useRef(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (scanState.kind !== 'searching') {
      inputRef.current?.focus()
    }
  }, [scanState.kind])

  async function runLookup(code: string) {
    if (lookupInProgressRef.current) {
      return
    }

    lookupInProgressRef.current = true
    setScanState({ kind: 'searching', code })

    try {
      const result = await lookupMicrochipByCode(code)

      if (result.kind === 'implanted') {
        navigate(`/animals/${result.animalId}`)
        return
      }

      setScanState({ kind: 'result', result })
    } catch {
      setScanState({ kind: 'error', code })
    } finally {
      lookupInProgressRef.current = false
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const code = normalizeMicrochipCode(inputValue)
    const validation = validateMicrochipCode(code)

    if (!validation.success) {
      setScanState({ kind: 'invalid', message: validation.error.issues[0]?.message ?? 'Código no válido.' })
      return
    }

    setInputValue('')
    void runLookup(validation.data)
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
      <section>
        <p className="text-sm font-semibold text-emerald-700">Consulta de identificación</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Escanear microchip</h1>
        <p className="mt-3 max-w-xl text-stone-700">
          Acerca el lector al microchip o escribe el código manualmente. Presiona Enter para buscar.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <ScannerInput disabled={scanState.kind === 'searching'} onChange={setInputValue} ref={inputRef} value={inputValue} />
          <button
            className="rounded-md bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={scanState.kind === 'searching'}
            type="submit"
          >
            {scanState.kind === 'searching' ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      </section>

      <section className="mt-8" aria-label="Resultado de la consulta">
        {scanState.kind === 'idle' ? <p className="text-sm text-stone-600">Listo para escanear.</p> : null}
        {scanState.kind === 'invalid' ? (
          <p className="text-sm text-red-700" role="alert">
            {scanState.message}
          </p>
        ) : null}
        {scanState.kind === 'searching' ? <p role="status">Buscando microchip…</p> : null}
        {scanState.kind === 'result' ? <ScanResult result={scanState.result} /> : null}
        {scanState.kind === 'error' ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5" role="alert">
            <p className="font-medium text-red-800">No fue posible consultar el microchip.</p>
            <button
              className="mt-3 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
              onClick={() => void runLookup(scanState.code)}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : null}
      </section>
    </main>
  )
}
