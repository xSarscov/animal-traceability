create function public.mark_recovery_report_reviewed(
  p_report_id uuid
)
returns public.recovery_report_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid;
  v_organization_id uuid;
  v_current_status public.recovery_report_status;
begin
  v_caller_id := auth.uid();

  if v_caller_id is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  select report.status, animal.organization_id
  into v_current_status, v_organization_id
  from public.recovery_reports as report
  join public.animals as animal
    on animal.id = report.animal_id
  where report.id = p_report_id
  for update of report;

  if not found
    or not exists (
      select 1
      from public.organization_members as membership
      where membership.organization_id = v_organization_id
        and membership.user_id = v_caller_id
    ) then
    raise exception 'Reporte no disponible.' using errcode = 'P0001';
  end if;

  if v_current_status <> 'pending'::public.recovery_report_status then
    raise exception 'Transición de reporte no disponible.' using errcode = 'P0001';
  end if;

  update public.recovery_reports
  set status = 'reviewed'::public.recovery_report_status
  where id = p_report_id;

  return 'reviewed'::public.recovery_report_status;
end;
$$;

create function public.close_recovery_report(
  p_report_id uuid
)
returns public.recovery_report_status
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid;
  v_organization_id uuid;
  v_current_status public.recovery_report_status;
begin
  v_caller_id := auth.uid();

  if v_caller_id is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  select report.status, animal.organization_id
  into v_current_status, v_organization_id
  from public.recovery_reports as report
  join public.animals as animal
    on animal.id = report.animal_id
  where report.id = p_report_id
  for update of report;

  if not found
    or not exists (
      select 1
      from public.organization_members as membership
      where membership.organization_id = v_organization_id
        and membership.user_id = v_caller_id
    ) then
    raise exception 'Reporte no disponible.' using errcode = 'P0001';
  end if;

  if v_current_status <> 'reviewed'::public.recovery_report_status then
    raise exception 'Transición de reporte no disponible.' using errcode = 'P0001';
  end if;

  update public.recovery_reports
  set status = 'closed'::public.recovery_report_status
  where id = p_report_id;

  return 'closed'::public.recovery_report_status;
end;
$$;

revoke all on function public.mark_recovery_report_reviewed(uuid) from public, anon, authenticated;
revoke all on function public.close_recovery_report(uuid) from public, anon, authenticated;

grant execute on function public.mark_recovery_report_reviewed(uuid) to authenticated;
grant execute on function public.close_recovery_report(uuid) to authenticated;
