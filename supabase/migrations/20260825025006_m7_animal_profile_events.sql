alter table public.animal_events
  alter column performed_by set default auth.uid();

revoke insert on table public.animal_events from authenticated;

grant insert (
  animal_id,
  event_type,
  title,
  description,
  metadata
)
on table public.animal_events
to authenticated;

create policy animal_events_insert_vaccination_or_note_for_members
on public.animal_events
for insert
to authenticated
with check (
  (select private.can_access_animal(animal_id))
  and event_type in ('vaccination'::public.animal_event_type, 'note'::public.animal_event_type)
  and performed_by = (select auth.uid())
);
