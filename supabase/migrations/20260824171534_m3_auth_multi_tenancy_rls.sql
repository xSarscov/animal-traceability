create schema private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
  );
$$;

create function private.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.role = 'admin'::public.organization_role
  );
$$;

create function private.can_access_animal(target_animal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.animals as animal
    join public.organization_members as membership
      on membership.organization_id = animal.organization_id
    where animal.id = target_animal_id
      and membership.user_id = auth.uid()
  );
$$;

revoke all on function private.is_organization_member(uuid) from public, anon;
revoke all on function private.is_organization_admin(uuid) from public, anon;
revoke all on function private.can_access_animal(uuid) from public, anon;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.is_organization_admin(uuid) to authenticated;
grant execute on function private.can_access_animal(uuid) to authenticated;

alter function public.assert_microchip_animal_cardinality_for_chip(uuid)
  security definer
  set search_path = pg_catalog, public;
alter function public.assert_microchip_animal_cardinality()
  security definer
  set search_path = pg_catalog, public;
alter function public.set_updated_at()
  set search_path = pg_catalog, public;

revoke all on function public.assert_microchip_animal_cardinality_for_chip(uuid)
  from public, anon, authenticated;
revoke all on function public.assert_microchip_animal_cardinality()
  from public, anon, authenticated;
revoke all on function public.set_updated_at()
  from public, anon, authenticated;

revoke all privileges on table
  public.organizations,
  public.organization_members,
  public.owners,
  public.microchips,
  public.animals,
  public.animal_events,
  public.recovery_reports
from public, anon, authenticated;

grant select on table
  public.organizations,
  public.organization_members,
  public.owners,
  public.microchips,
  public.animals,
  public.animal_events,
  public.recovery_reports
to authenticated;

create policy organizations_select_for_members
on public.organizations
for select
to authenticated
using ((select private.is_organization_member(id)));

create policy organization_members_select_self_or_admin
on public.organization_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_organization_admin(organization_id))
);

create policy owners_select_for_members
on public.owners
for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy microchips_select_for_members
on public.microchips
for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy animals_select_for_members
on public.animals
for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy animal_events_select_for_members
on public.animal_events
for select
to authenticated
using ((select private.can_access_animal(animal_id)));

create policy recovery_reports_select_for_members
on public.recovery_reports
for select
to authenticated
using ((select private.can_access_animal(animal_id)));
