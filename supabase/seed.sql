insert into public.organizations (id, name, slug)
values (
  '11111111-1111-4111-8111-111111111111',
  'Animal Traceability Demo',
  'animal-traceability-demo'
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug;

insert into public.microchips (
  id,
  organization_id,
  code,
  technology,
  frequency_khz,
  standard,
  status
)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '990000015300168',
  'FDX-B',
  134.2,
  'ISO 11784/11785',
  'available'
)
on conflict (code) do update
set
  organization_id = excluded.organization_id,
  technology = excluded.technology,
  frequency_khz = excluded.frequency_khz,
  standard = excluded.standard,
  batch_code = null,
  status = excluded.status;
