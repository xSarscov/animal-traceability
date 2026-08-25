create function public.mark_animal_lost(
  p_animal_id uuid
)
returns public.animal_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid;
  v_organization_id uuid;
  v_current_status public.animal_status;
  v_occurred_at timestamptz;
begin
  v_caller_id := auth.uid();

  if v_caller_id is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  select animal.organization_id, animal.status
  into v_organization_id, v_current_status
  from public.animals as animal
  where animal.id = p_animal_id
  for update;

  if not found
    or not exists (
      select 1
      from public.organization_members as membership
      where membership.organization_id = v_organization_id
        and membership.user_id = v_caller_id
    ) then
    raise exception 'Animal no disponible.' using errcode = 'P0001';
  end if;

  if v_current_status <> 'active'::public.animal_status then
    raise exception 'Transición de estado no disponible.' using errcode = 'P0001';
  end if;

  update public.animals
  set status = 'lost'::public.animal_status
  where id = p_animal_id;

  v_occurred_at := now();

  insert into public.animal_events (
    animal_id,
    event_type,
    title,
    performed_by,
    occurred_at,
    metadata
  )
  values (
    p_animal_id,
    'status_change'::public.animal_event_type,
    'Animal marcado como perdido',
    v_caller_id,
    v_occurred_at,
    '{}'::jsonb
  );

  return 'lost'::public.animal_status;
end;
$$;

create function public.mark_animal_found(
  p_animal_id uuid
)
returns public.animal_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid;
  v_organization_id uuid;
  v_current_status public.animal_status;
  v_occurred_at timestamptz;
begin
  v_caller_id := auth.uid();

  if v_caller_id is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  select animal.organization_id, animal.status
  into v_organization_id, v_current_status
  from public.animals as animal
  where animal.id = p_animal_id
  for update;

  if not found
    or not exists (
      select 1
      from public.organization_members as membership
      where membership.organization_id = v_organization_id
        and membership.user_id = v_caller_id
    ) then
    raise exception 'Animal no disponible.' using errcode = 'P0001';
  end if;

  if v_current_status <> 'lost'::public.animal_status then
    raise exception 'Transición de estado no disponible.' using errcode = 'P0001';
  end if;

  update public.animals
  set status = 'active'::public.animal_status
  where id = p_animal_id;

  v_occurred_at := now();

  insert into public.animal_events (
    animal_id,
    event_type,
    title,
    performed_by,
    occurred_at,
    metadata
  )
  values (
    p_animal_id,
    'status_change'::public.animal_event_type,
    'Animal marcado como encontrado',
    v_caller_id,
    v_occurred_at,
    '{}'::jsonb
  );

  return 'active'::public.animal_status;
end;
$$;

revoke execute on function public.mark_animal_lost(uuid) from public, anon;
revoke execute on function public.mark_animal_found(uuid) from public, anon;

grant execute on function public.mark_animal_lost(uuid) to authenticated;
grant execute on function public.mark_animal_found(uuid) to authenticated;
