create function public.get_public_animal_by_chip(
  p_chip_code text
)
returns table (
  chip_code text,
  name text,
  species text,
  breed text,
  sex public.animal_sex,
  color text,
  status public.animal_status
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_chip_code text;
begin
  v_chip_code := btrim(p_chip_code);

  if v_chip_code is null or v_chip_code !~ '^[0-9]{10,20}$' then
    return;
  end if;

  return query
  select
    microchip.code,
    animal.name,
    animal.species,
    animal.breed,
    animal.sex,
    animal.color,
    animal.status
  from public.microchips as microchip
  join public.animals as animal
    on animal.microchip_id = microchip.id
  where microchip.code = v_chip_code
    and microchip.status = 'implanted'::public.microchip_status;
end;
$$;

create function public.submit_recovery_report(
  p_chip_code text,
  p_reporter_name text,
  p_contact text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_chip_code text;
  v_reporter_name text;
  v_contact text;
  v_message text;
  v_animal_id uuid;
begin
  v_chip_code := btrim(p_chip_code);
  v_reporter_name := nullif(btrim(p_reporter_name), '');
  v_contact := nullif(btrim(p_contact), '');
  v_message := nullif(btrim(p_message), '');

  if v_chip_code is null
    or v_chip_code !~ '^[0-9]{10,20}$'
    or v_reporter_name is null
    or char_length(v_reporter_name) > 120
    or v_contact is null
    or char_length(v_contact) > 200
    or (v_message is not null and char_length(v_message) > 1000) then
    raise exception 'Reporte no disponible.' using errcode = 'P0001';
  end if;

  select animal.id
  into v_animal_id
  from public.microchips as microchip
  join public.animals as animal
    on animal.microchip_id = microchip.id
  where microchip.code = v_chip_code
    and microchip.status = 'implanted'::public.microchip_status
    and animal.status = 'lost'::public.animal_status
  for share of animal;

  if not found then
    raise exception 'Reporte no disponible.' using errcode = 'P0001';
  end if;

  insert into public.recovery_reports (
    animal_id,
    reporter_name,
    contact,
    message,
    status
  )
  values (
    v_animal_id,
    v_reporter_name,
    v_contact,
    v_message,
    'pending'::public.recovery_report_status
  );
end;
$$;

revoke all on function public.get_public_animal_by_chip(text) from public, anon, authenticated;
revoke all on function public.submit_recovery_report(text, text, text, text) from public, anon, authenticated;

grant execute on function public.get_public_animal_by_chip(text) to anon, authenticated;
grant execute on function public.submit_recovery_report(text, text, text, text) to anon, authenticated;
