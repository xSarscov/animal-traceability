import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactNode, useEffect, useState } from 'react'
import { type UseFormRegister, useForm, useWatch } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'

import { normalizeMicrochipCode, validateMicrochipCode } from '../scanner/microchip-code'
import {
  getRegistrationMicrochip,
  listOwnersForOrganization,
  registerAnimalWithChip,
  type ExistingOwner,
  type RegistrationMicrochip,
} from './animal-registration'
import {
  animalRegistrationDefaultValues,
  animalRegistrationSchema,
  type AnimalRegistrationFormValues,
  type ParsedAnimalRegistrationFormValues,
} from './animal-registration-schema'

type PreflightState =
  | { kind: 'loading' }
  | { kind: 'missing' | 'invalid' | 'unknown' | 'blocked' | 'implanted' | 'error' }
  | { kind: 'available'; microchip: RegistrationMicrochip }

export function AnimalRegistrationPage() {
  const [searchParams] = useSearchParams()
  const rawChipCode = searchParams.get('chip')
  const chipCode = rawChipCode ? normalizeMicrochipCode(rawChipCode) : null

  return <AnimalRegistrationFlow key={chipCode ?? '__missing-chip__'} chipCode={chipCode} />
}

function AnimalRegistrationFlow({ chipCode }: { chipCode: string | null }) {
  const [preflight, setPreflight] = useState<PreflightState>(() => getInitialPreflight(chipCode))
  const [owners, setOwners] = useState<ExistingOwner[] | null>(null)
  const [ownersError, setOwnersError] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ animalName: string; chipCode: string } | null>(null)
  const form = useForm<AnimalRegistrationFormValues, unknown, ParsedAnimalRegistrationFormValues>({
    defaultValues: animalRegistrationDefaultValues,
    resolver: zodResolver(animalRegistrationSchema),
  })
  const ownerMode = useWatch({ control: form.control, name: 'ownerMode' })

  useEffect(() => {
    if (!chipCode || !validateMicrochipCode(chipCode).success) {
      return
    }

    let active = true
    void getRegistrationMicrochip(chipCode)
      .then((microchip) => {
        if (!active) return
        setPreflight(getMicrochipPreflight(microchip))
      })
      .catch(() => {
        if (active) setPreflight({ kind: 'error' })
      })

    return () => {
      active = false
    }
  }, [chipCode])

  useEffect(() => {
    if (ownerMode !== 'existing' || preflight.kind !== 'available' || owners !== null) {
      return
    }

    let active = true
    void listOwnersForOrganization(preflight.microchip.organization_id)
      .then((data) => {
        if (active) setOwners(data)
      })
      .catch(() => {
        if (active) setOwnersError(true)
      })

    return () => {
      active = false
    }
  }, [ownerMode, owners, preflight])

  async function onSubmit(values: ParsedAnimalRegistrationFormValues) {
    if (preflight.kind !== 'available') return

    setSubmissionError(null)
    const parsed = values

    try {
      await registerAnimalWithChip({ chipCode: preflight.microchip.code, values: parsed })
      setSuccess({ animalName: parsed.animalName, chipCode: preflight.microchip.code })
    } catch (error) {
      setSubmissionError(
        error instanceof Error && error.message.includes('ya no está disponible')
          ? 'El microchip ya no está disponible para registro. Vuelve a escanearlo.'
          : 'No fue posible completar el registro. Inténtalo de nuevo.',
      )
    }
  }

  if (success) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <h1 className="text-2xl font-semibold text-stone-950">Animal registrado</h1>
          <p className="mt-3 text-stone-700">{success.animalName} quedó asociado al microchip {success.chipCode}.</p>
          <p className="mt-1 text-stone-700">El microchip quedó implantado.</p>
          <Link className="mt-5 inline-flex rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white" to="/scan">
            Volver a escanear
          </Link>
        </section>
      </main>
    )
  }

  if (preflight.kind !== 'available') {
    return <PreflightMessage state={preflight.kind} />
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Registro transaccional</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Registrar animal</h1>
        </div>
        <Link className="text-sm font-medium text-emerald-800 underline underline-offset-4" to="/scan">Volver a escanear</Link>
      </div>

      <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4" aria-label="Microchip seleccionado">
        <p className="font-mono text-sm text-stone-800">{preflight.microchip.code}</p>
        <p className="mt-1 text-sm font-semibold text-emerald-800">Disponible</p>
      </section>

      <form className="mt-8 space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-stone-950">Animal</legend>
          <Field label="Nombre *" error={form.formState.errors.animalName?.message}><input {...form.register('animalName')} /></Field>
          <Field label="Especie *" error={form.formState.errors.species?.message}><input {...form.register('species')} /></Field>
          <Field label="Raza" error={form.formState.errors.breed?.message}><input {...form.register('breed')} /></Field>
          <Field label="Sexo *" error={form.formState.errors.sex?.message}>
            <select {...form.register('sex')}><option value="male">Macho</option><option value="female">Hembra</option><option value="unknown">Desconocido</option></select>
          </Field>
          <Field label="Fecha de nacimiento" error={form.formState.errors.birthDate?.message}><input type="date" {...form.register('birthDate')} /></Field>
          <Field label="Color" error={form.formState.errors.color?.message}><input {...form.register('color')} /></Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-stone-950">Propietario</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="radio" value="new" {...form.register('ownerMode')} /> Nuevo propietario</label>
            <label className="flex items-center gap-2"><input type="radio" value="existing" {...form.register('ownerMode')} /> Propietario existente</label>
          </div>
          {ownerMode === 'new' ? (
            <>
              <Field label="Nombre completo *" error={form.formState.errors.ownerFullName?.message}><input {...form.register('ownerFullName')} /></Field>
              <Field label="Teléfono" error={form.formState.errors.ownerPhone?.message}><input {...form.register('ownerPhone')} /></Field>
              <Field label="Email" error={form.formState.errors.ownerEmail?.message}><input type="email" {...form.register('ownerEmail')} /></Field>
              <Field label="Dirección" error={form.formState.errors.ownerAddress?.message}><textarea {...form.register('ownerAddress')} /></Field>
            </>
          ) : <ExistingOwnerSelect owners={owners} error={ownersError} register={form.register} fieldError={form.formState.errors.existingOwnerId?.message} />}
        </fieldset>

        {submissionError ? <p className="text-sm text-red-700" role="alert">{submissionError}</p> : null}
        <button className="rounded-md bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? 'Registrando…' : 'Registrar animal'}
        </button>
      </form>
    </main>
  )
}

function getInitialPreflight(chipCode: string | null): PreflightState {
  if (!chipCode) return { kind: 'missing' }
  return validateMicrochipCode(chipCode).success ? { kind: 'loading' } : { kind: 'invalid' }
}

function getMicrochipPreflight(microchip: RegistrationMicrochip | null): PreflightState {
  if (!microchip) return { kind: 'unknown' }
  if (microchip.status === 'available') return { kind: 'available', microchip }
  return { kind: microchip.status }
}

function PreflightMessage({ state }: { state: Exclude<PreflightState['kind'], 'available'> }) {
  const content = {
    loading: 'Comprobando microchip…',
    missing: 'Escanea primero un microchip disponible.',
    invalid: 'El código del microchip no es válido.',
    unknown: 'Microchip no reconocido.',
    blocked: 'Microchip bloqueado.',
    implanted: 'Este microchip ya está implantado.',
    error: 'No fue posible comprobar el microchip.',
  }[state]

  return <main className="mx-auto max-w-2xl px-6 py-10 sm:py-14"><section className="rounded-lg border border-stone-200 bg-white p-6"><h1 className="text-2xl font-semibold text-stone-950">{content}</h1>{state !== 'loading' ? <Link className="mt-5 inline-flex text-sm font-semibold text-emerald-800 underline" to="/scan">Volver a escanear</Link> : null}</section></main>
}

function ExistingOwnerSelect({ owners, error, fieldError, register }: { owners: ExistingOwner[] | null; error: boolean; fieldError?: string; register: UseFormRegister<AnimalRegistrationFormValues> }) {
  if (error) return <p className="text-sm text-red-700" role="alert">No fue posible cargar los propietarios.</p>
  if (owners === null) return <p role="status">Cargando propietarios…</p>
  if (owners.length === 0) return <p className="text-sm text-stone-700">No hay propietarios existentes. Selecciona “Nuevo propietario”.</p>
  return <Field label="Propietario existente *" error={fieldError}><select {...register('existingOwnerId')}><option value="">Selecciona un propietario</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}{owner.phone ? ` · ${owner.phone}` : ''}{owner.email ? ` · ${owner.email}` : ''}</option>)}</select></Field>
}

function Field({ children, error, label }: { children: ReactNode; error?: string; label: string }) {
  return <label className="block text-sm font-medium text-stone-800"><span>{label}</span><span className="mt-1 block [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-stone-300 [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-stone-300 [&_select]:px-3 [&_select]:py-2 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-stone-300 [&_textarea]:px-3 [&_textarea]:py-2">{children}</span>{error ? <span className="mt-1 block text-red-700" role="alert">{error}</span> : null}</label>
}
