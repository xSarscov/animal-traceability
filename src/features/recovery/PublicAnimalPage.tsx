import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router'

import { normalizeMicrochipCode, validateMicrochipCode } from '../scanner/microchip-code'
import {
  getPublicAnimalByChip,
  PublicRecoverySubmitError,
  submitRecoveryReport,
  type PublicAnimal,
} from './public-animal'
import {
  publicRecoveryDefaultValues,
  publicRecoverySchema,
  type ParsedPublicRecoveryFormValues,
  type PublicRecoveryFormValues,
} from './public-recovery-schema'

type PublicProfileState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'loaded'; animal: PublicAnimal }

export function PublicAnimalPage() {
  const { chipCode: rawChipCode } = useParams()
  const normalizedChipCode = rawChipCode ? normalizeMicrochipCode(rawChipCode) : null
  const chipCode = normalizedChipCode && validateMicrochipCode(normalizedChipCode).success ? normalizedChipCode : null

  return <PublicAnimalFlow key={chipCode ?? rawChipCode ?? '__invalid-chip__'} chipCode={chipCode} />
}

function PublicAnimalFlow({ chipCode }: { chipCode: string | null }) {
  const [profileState, setProfileState] = useState<PublicProfileState>(() => chipCode ? { kind: 'loading' } : { kind: 'not-found' })
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    if (!chipCode) return
    let active = true
    void getPublicAnimalByChip(chipCode)
      .then((animal) => { if (active) setProfileState(animal ? { kind: 'loaded', animal } : { kind: 'not-found' }) })
      .catch(() => { if (active) setProfileState({ kind: 'error' }) })
    return () => { active = false }
  }, [chipCode, retryVersion])

  if (profileState.kind === 'loading') return <PublicMessage message="Cargando información…" />
  if (profileState.kind === 'not-found') return <PublicMessage message="Microchip no encontrado." />
  if (profileState.kind === 'error') return <PublicMessage message="No fue posible consultar el microchip." retry={() => { setProfileState({ kind: 'loading' }); setRetryVersion((version) => version + 1) }} />

  return <PublicAnimalDetails animal={profileState.animal} onUnavailable={() => { setProfileState({ kind: 'loading' }); setRetryVersion((version) => version + 1) }} />
}

function PublicAnimalDetails({ animal, onUnavailable }: { animal: PublicAnimal; onUnavailable: () => void }) {
  return <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
    <p className="text-sm font-semibold tracking-[0.16em] text-emerald-700">ANIMAL TRACEABILITY</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-950">{animal.name}</h1>
    <p className="mt-2 text-lg text-stone-700">{animal.species} · {sexLabel(animal.sex)}</p>
    <p className="mt-4 inline-flex rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-900">{statusLabel(animal.status)}</p>

    {animal.status === 'lost' ? <p className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-950">Animal reportado como perdido</p> : null}
    {animal.status === 'active' ? <p className="mt-5 text-stone-700">Este animal está registrado y no figura como perdido.</p> : null}

    <section className="mt-8 rounded-lg border border-stone-200 p-5" aria-labelledby="public-animal-details">
      <h2 className="text-xl font-semibold text-stone-950" id="public-animal-details">Información del animal</h2>
      <dl className="mt-4 space-y-3">
        <Detail label="Código de microchip" value={animal.chipCode} />
        <Detail label="Nombre" value={animal.name} />
        <Detail label="Especie" value={animal.species} />
        <Detail label="Raza" value={animal.breed} />
        <Detail label="Sexo" value={sexLabel(animal.sex)} />
        <Detail label="Color" value={animal.color} />
        <Detail label="Estado" value={statusLabel(animal.status)} />
      </dl>
    </section>

    {animal.status === 'lost' ? <PublicRecoveryForm chipCode={animal.chipCode} onUnavailable={onUnavailable} /> : null}
  </main>
}

function PublicRecoveryForm({ chipCode, onUnavailable }: { chipCode: string; onUnavailable: () => void }) {
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const form = useForm<PublicRecoveryFormValues, unknown, ParsedPublicRecoveryFormValues>({
    defaultValues: publicRecoveryDefaultValues,
    resolver: zodResolver(publicRecoverySchema),
  })

  async function onSubmit(values: ParsedPublicRecoveryFormValues) {
    setMessage(null)
    try {
      await submitRecoveryReport({ chipCode, ...values })
      setSubmitted(true)
      setMessage('Reporte enviado.')
    } catch (error) {
      if (error instanceof PublicRecoverySubmitError && error.kind === 'unavailable') {
        onUnavailable()
      } else {
        setMessage('No fue posible enviar el reporte.')
      }
    }
  }

  if (submitted) return <section className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5" aria-live="polite"><h2 className="text-xl font-semibold text-emerald-950">Reporte enviado.</h2><p className="mt-2 text-emerald-900">El personal autorizado podrá revisar la información proporcionada.</p></section>

  return <section className="mt-8 rounded-lg border border-stone-200 p-5" aria-labelledby="recovery-title">
    <h2 className="text-xl font-semibold text-stone-950" id="recovery-title">Encontré este animal</h2>
    <form className="mt-4 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Nombre *" error={form.formState.errors.reporterName?.message}><input aria-label="Nombre *" {...form.register('reporterName')} /></Field>
      <Field label="Contacto *" error={form.formState.errors.contact?.message}><input aria-label="Contacto *" {...form.register('contact')} /></Field>
      <Field label="Mensaje" error={form.formState.errors.message?.message}><textarea aria-label="Mensaje" {...form.register('message')} /></Field>
      <button className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? 'Enviando…' : 'Enviar reporte'}</button>
    </form>
    {message ? <p className={`mt-3 text-sm ${message.startsWith('No fue') || message.startsWith('El reporte ya') ? 'text-red-700' : 'text-emerald-700'}`} role={message.startsWith('Reporte') ? 'status' : 'alert'}>{message}</p> : null}
  </section>
}

function PublicMessage({ message, retry }: { message: string; retry?: () => void }) {
  return <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14"><h1 className="text-2xl font-semibold text-stone-950">{message}</h1>{retry ? <button className="mt-4 rounded-md border px-3 py-2 text-sm font-semibold" onClick={retry} type="button">Reintentar</button> : null}</main>
}
function Detail({ label, value }: { label: string; value: string | null }) { return <div className="grid gap-1 sm:grid-cols-2"><dt className="text-sm text-stone-600">{label}</dt><dd className="text-sm font-medium text-stone-900">{value ?? '—'}</dd></div> }
function Field({ children, error, label }: { children: ReactNode; error?: string; label: string }) { return <label className="block text-sm font-medium text-stone-800"><span>{label}</span><span className="mt-1 block [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-stone-300 [&_input]:px-3 [&_input]:py-2 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-stone-300 [&_textarea]:px-3 [&_textarea]:py-2">{children}</span>{error ? <span className="mt-1 block text-red-700" role="alert">{error}</span> : null}</label> }
function sexLabel(sex: PublicAnimal['sex']) { return ({ male: 'Macho', female: 'Hembra', unknown: 'Desconocido' })[sex] }
function statusLabel(status: PublicAnimal['status']) { return ({ active: 'Activo', lost: 'Perdido', deceased: 'Fallecido' })[status] }
