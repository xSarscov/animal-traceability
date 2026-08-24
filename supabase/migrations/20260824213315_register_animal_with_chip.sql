create function public.register_animal_with_chip(
  p_chip_code text,
  p_animal_name text,
  p_species text,
  p_breed text,
  p_sex public.animal_sex,
  p_birth_date date,
  p_color text,
  p_existing_owner_id uuid,
  p_owner_full_name text,
  p_owner_phone text,
  p_owner_email text,
  p_owner_address text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid;
  v_chip_code text;
  v_animal_name text;
  v_species text;
  v_breed text;
  v_color text;
  v_owner_full_name text;
  v_owner_phone text;
  v_owner_email text;
  v_owner_address text;
  v_chip_id uuid;
  v_organization_id uuid;
  v_chip_status public.microchip_status;
  v_owner_id uuid;
  v_animal_id uuid;
  v_occurred_at timestamptz;
begin
  v_caller_id := auth.uid();

  if v_caller_id is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  v_chip_code := btrim(p_chip_code);
  v_animal_name := nullif(btrim(p_animal_name), '');
  v_species := nullif(btrim(p_species), '');
  v_breed := nullif(btrim(p_breed), '');
  v_color := nullif(btrim(p_color), '');
  v_owner_full_name := nullif(btrim(p_owner_full_name), '');
  v_owner_phone := nullif(btrim(p_owner_phone), '');
  v_owner_email := nullif(btrim(p_owner_email), '');
  v_owner_address := nullif(btrim(p_owner_address), '');

  if v_chip_code is null or v_chip_code !~ '^[0-9]{10,20}$' then
    raise exception 'Código de microchip inválido.' using errcode = '22023';
  end if;

  if v_animal_name is null or v_species is null or p_sex is null then
    raise exception 'Datos del animal no válidos.' using errcode = '22023';
  end if;

  select microchip.id, microchip.organization_id, microchip.status
  into v_chip_id, v_organization_id, v_chip_status
  from public.microchips as microchip
  where microchip.code = v_chip_code
  for update;

  if not found
    or not exists (
      select 1
      from public.organization_members as membership
      where membership.organization_id = v_organization_id
        and membership.user_id = v_caller_id
    )
    or v_chip_status <> 'available'::public.microchip_status then
    raise exception 'Microchip no disponible para registro.' using errcode = 'P0001';
  end if;

  if p_existing_owner_id is not null then
    select owner.id
    into v_owner_id
    from public.owners as owner
    where owner.id = p_existing_owner_id
      and owner.organization_id = v_organization_id;

    if not found then
      raise exception 'Propietario no disponible.' using errcode = 'P0001';
    end if;
  else
    if v_owner_full_name is null then
      raise exception 'Datos del propietario no válidos.' using errcode = '22023';
    end if;

    insert into public.owners (
      organization_id,
      full_name,
      phone,
      email,
      address
    )
    values (
      v_organization_id,
      v_owner_full_name,
      v_owner_phone,
      v_owner_email,
      v_owner_address
    )
    returning id into v_owner_id;
  end if;

  insert into public.animals (
    organization_id,
    microchip_id,
    owner_id,
    name,
    species,
    breed,
    sex,
    birth_date,
    color
  )
  values (
    v_organization_id,
    v_chip_id,
    v_owner_id,
    v_animal_name,
    v_species,
    v_breed,
    p_sex,
    p_birth_date,
    v_color
  )
  returning id into v_animal_id;

  update public.microchips
  set status = 'implanted'::public.microchip_status
  where id = v_chip_id;

  v_occurred_at := now();

  insert into public.animal_events (animal_id, event_type, title, performed_by, occurred_at)
  values
    (v_animal_id, 'registration'::public.animal_event_type, 'Animal registrado', v_caller_id, v_occurred_at),
    (v_animal_id, 'implantation'::public.animal_event_type, 'Microchip implantado', v_caller_id, v_occurred_at);

  return v_animal_id;
end;
$$;

revoke execute on function public.register_animal_with_chip(
  text, text, text, text, public.animal_sex, date, text, uuid, text, text, text, text
) from public, anon;

grant execute on function public.register_animal_with_chip(
  text, text, text, text, public.animal_sex, date, text, uuid, text, text, text, text
) to authenticated;
