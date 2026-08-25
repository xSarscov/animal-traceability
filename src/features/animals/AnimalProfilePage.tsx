import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactNode, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router'
import { z } from 'zod'

import { formatDate, formatDateTime } from '../../lib/dates'
import {
  createNoteEvent,
  createVaccinationEvent,
  getAnimalProfile,
  listAnimalEvents,
  type AnimalEvent,
  type AnimalProfile,
} from './animal-profile'
import {
  noteEventDefaultValues,
  noteEventSchema,
  type NoteEventFormValues,
  type ParsedNoteEventFormValues,
  type ParsedVaccinationEventFormValues,
  type VaccinationEventFormValues,
  vaccinationEventDefaultValues,
  vaccinationEventSchema,
} from './animal-events-schema'

type ProfileState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error' }
  | { kind: 'loaded'; profile: AnimalProfile }

type TimelineState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; events: AnimalEvent[] }

const uuidSchema = z.string().uuid()

export function AnimalProfilePage() {
  const { animalId } = useParams()
  const validAnimalId = animalId && uuidSchema.safeParse(animalId).success ? animalId : null

  return <AnimalProfileFlow key={validAnimalId ?? animalId ?? '__invalid-animal__'} animalId={validAnimalId} />
}

function AnimalProfileFlow({ animalId }: { animalId: string | null }) {
  const [profileState, setProfileState] = useState<ProfileState>(() => animalId ? { kind: 'loading' } : { kind: 'not-found' })
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    if (!animalId) return
    let active = true
    void getAnimalProfile(animalId)
      .then((profile) => {
        if (active) setProfileState(profile ? { kind: 'loaded', profile } : { kind: 'not-found' })
      })
      .catch(() => {
        if (active) setProfileState({ kind: 'error' })
      })
    return () => { active = false }
  }, [animalId, retryVersion])

  if (profileState.kind === 'loading') return <ProfileMessage message="Cargando perfil…" />
  if (profileState.kind === 'not-found') return <ProfileMessage message="Animal no encontrado." />
  if (profileState.kind === 'error') return <ProfileMessage message="No fue posible cargar el perfil." retry={() => { setProfileState({ kind: 'loading' }); setRetryVersion((version) => version + 1) }} />

  return <AnimalProfileContent profile={profileState.profile} />
}

function AnimalProfileContent({ profile }: { profile: AnimalProfile }) {
  const [timelineState, setTimelineState] = useState<TimelineState>({ kind: 'loading' })
  const [timelineVersion, setTimelineVersion] = useState(0)

  useEffect(() => {
    let active = true
    void listAnimalEvents(profile.animal.id)
      .then((events) => { if (active) setTimelineState({ kind: 'loaded', events }) })
      .catch(() => { if (active) setTimelineState({ kind: 'error' }) })
    return () => { active = false }
  }, [profile.animal.id, timelineVersion])

  const refreshTimeline = () => {
    setTimelineState({ kind: 'loading' })
    setTimelineVersion((version) => version + 1)
  }
  const { animal, microchip, owner } = profile

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <header className="border-b border-stone-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">Perfil privado</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-950">{animal.name}</h1>
        <p className="mt-2 text-lg text-stone-700">{animal.species} · {sexLabel(animal.sex)}</p>
        <p className="mt-3 inline-flex rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-800">{statusLabel(animal.status)}</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ProfileSection title="Microchip"><Details values={[
          ['Código', microchip.code], ['Tecnología', microchip.technology], ['Frecuencia', `${microchip.frequency_khz} kHz`], ['Estándar', microchip.standard], ['Lote', microchip.batch_code], ['Estado', microchip.status === 'implanted' ? 'Implantado' : microchip.status],
        ]} /></ProfileSection>
        <ProfileSection title="Propietario"><Details values={[
          ['Nombre', owner.full_name], ['Teléfono', owner.phone], ['Email', owner.email], ['Dirección', owner.address],
        ]} /></ProfileSection>
        <ProfileSection title="Datos del animal"><Details values={[
          ['Raza', animal.breed], ['Fecha de nacimiento', animal.birth_date ? formatDate(animal.birth_date) : null], ['Color', animal.color], ['Registrado', formatDate(animal.created_at)],
        ]} /></ProfileSection>
      </div>

      <section className="mt-10" aria-labelledby="historial-title">
        <h2 className="text-2xl font-semibold text-stone-950" id="historial-title">Historial</h2>
        {timelineState.kind === 'loading' ? <p className="mt-4" role="status">Cargando historial…</p> : null}
        {timelineState.kind === 'error' ? <div className="mt-4" role="alert"><p>No fue posible cargar el historial.</p><button className="mt-3 rounded-md border px-3 py-2 text-sm font-semibold" onClick={refreshTimeline} type="button">Reintentar</button></div> : null}
        {timelineState.kind === 'loaded' ? <Timeline events={timelineState.events} /> : null}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2" aria-label="Agregar eventos">
        <VaccinationForm animalId={animal.id} onCreated={refreshTimeline} />
        <NoteForm animalId={animal.id} onCreated={refreshTimeline} />
      </section>
    </main>
  )
}

function Timeline({ events }: { events: AnimalEvent[] }) {
  if (events.length === 0) return <p className="mt-4 text-stone-700">No hay eventos registrados.</p>
  return <ol className="mt-5 space-y-4">{events.map((event) => <li className="rounded-lg border border-stone-200 bg-white p-4" key={event.id}>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-stone-950">{event.title}</p><span className="text-sm text-stone-600">{eventLabel(event.event_type)}</span></div>
    <p className="mt-1 text-sm text-stone-600">{formatDateTime(event.occurred_at)}</p>
    {event.description ? <p className="mt-3 text-stone-700">{event.description}</p> : null}
    {event.event_type === 'vaccination' ? <VaccinationMetadata metadata={event.metadata} /> : null}
  </li>)}</ol>
}

const vaccinationMetadataSchema = z.object({ vaccine: z.string(), batch: z.string().optional(), nextDose: z.string().optional() })
function VaccinationMetadata({ metadata }: { metadata: AnimalEvent['metadata'] }) {
  const parsed = vaccinationMetadataSchema.safeParse(metadata)
  if (!parsed.success) return null
  return <p className="mt-3 text-sm text-stone-700">Vacuna: {parsed.data.vaccine}{parsed.data.batch ? ` · Lote: ${parsed.data.batch}` : ''}{parsed.data.nextDose ? ` · Próxima dosis: ${formatDate(parsed.data.nextDose)}` : ''}</p>
}

function VaccinationForm({ animalId, onCreated }: { animalId: string; onCreated: () => void }) {
  const [message, setMessage] = useState<string | null>(null)
  const form = useForm<VaccinationEventFormValues, unknown, ParsedVaccinationEventFormValues>({ defaultValues: vaccinationEventDefaultValues, resolver: zodResolver(vaccinationEventSchema) })
  async function onSubmit(values: ParsedVaccinationEventFormValues) {
    setMessage(null)
    try { await createVaccinationEvent({ animalId, values }); form.reset(); setMessage('Vacunación registrada.'); onCreated() }
    catch { setMessage('No fue posible registrar la vacunación.') }
  }
  return <EventForm title="Registrar vacunación" message={message}><form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
    <InputField label="Vacuna *" error={form.formState.errors.vaccine?.message}><input {...form.register('vaccine')} /></InputField>
    <InputField label="Lote"><input {...form.register('batch')} /></InputField>
    <InputField label="Próxima dosis"><input type="date" {...form.register('nextDose')} /></InputField>
    <InputField label="Notas"><textarea {...form.register('description')} /></InputField>
    <button className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? 'Registrando…' : 'Registrar vacunación'}</button>
  </form></EventForm>
}

function NoteForm({ animalId, onCreated }: { animalId: string; onCreated: () => void }) {
  const [message, setMessage] = useState<string | null>(null)
  const form = useForm<NoteEventFormValues, unknown, ParsedNoteEventFormValues>({ defaultValues: noteEventDefaultValues, resolver: zodResolver(noteEventSchema) })
  async function onSubmit(values: ParsedNoteEventFormValues) {
    setMessage(null)
    try { await createNoteEvent({ animalId, values }); form.reset(); setMessage('Nota agregada.'); onCreated() }
    catch { setMessage('No fue posible agregar la nota.') }
  }
  return <EventForm title="Agregar nota" message={message}><form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
    <InputField label="Título *" error={form.formState.errors.title?.message}><input {...form.register('title')} /></InputField>
    <InputField label="Descripción"><textarea {...form.register('description')} /></InputField>
    <button className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? 'Agregando…' : 'Agregar nota'}</button>
  </form></EventForm>
}

function EventForm({ children, message, title }: { children: ReactNode; message: string | null; title: string }) {
  return <section className="rounded-lg border border-stone-200 p-5"><h2 className="text-xl font-semibold text-stone-950">{title}</h2><div className="mt-4">{children}</div>{message ? <p className={`mt-3 text-sm ${message.startsWith('No fue') ? 'text-red-700' : 'text-emerald-700'}`} role={message.startsWith('No fue') ? 'alert' : 'status'}>{message}</p> : null}</section>
}

function InputField({ children, error, label }: { children: ReactNode; error?: string; label: string }) {
  return <label className="block text-sm font-medium text-stone-800"><span>{label}</span><span className="mt-1 block [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-stone-300 [&_input]:px-3 [&_input]:py-2 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-stone-300 [&_textarea]:px-3 [&_textarea]:py-2">{children}</span>{error ? <span className="mt-1 block text-red-700" role="alert">{error}</span> : null}</label>
}

function ProfileSection({ children, title }: { children: ReactNode; title: string }) { return <section className="rounded-lg border border-stone-200 p-5"><h2 className="text-xl font-semibold text-stone-950">{title}</h2><div className="mt-4">{children}</div></section> }
function Details({ values }: { values: Array<[string, string | number | null]> }) { return <dl className="space-y-3">{values.map(([label, value]) => <div className="grid gap-1 sm:grid-cols-2" key={label}><dt className="text-sm text-stone-600">{label}</dt><dd className="text-sm font-medium text-stone-900">{value ?? '—'}</dd></div>)}</dl> }
function ProfileMessage({ message, retry }: { message: string; retry?: () => void }) { return <main className="mx-auto max-w-4xl px-6 py-10"><h1 className="text-2xl font-semibold text-stone-950">{message}</h1>{retry ? <button className="mt-4 rounded-md border px-3 py-2 text-sm font-semibold" onClick={retry} type="button">Reintentar</button> : null}</main> }
function sexLabel(sex: AnimalProfile['animal']['sex']) { return ({ male: 'Macho', female: 'Hembra', unknown: 'Desconocido' })[sex] }
function statusLabel(status: AnimalProfile['animal']['status']) { return ({ active: 'Activo', lost: 'Perdido', deceased: 'Fallecido' })[status] }
function eventLabel(type: AnimalEvent['event_type']) { return ({ registration: 'Registro', implantation: 'Implantación', vaccination: 'Vacunación', status_change: 'Cambio de estado', note: 'Nota' })[type] }
