begin;
select plan(41);

insert into auth.users (id, email)
values
  ('d8100000-0000-4000-8000-000000000001', 'staff-status-a@example.test'),
  ('d8100000-0000-4000-8000-000000000002', 'staff-status-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('d8200000-0000-4000-8000-000000000001', 'Status Organization A', 'status-organization-a'),
  ('d8200000-0000-4000-8000-000000000002', 'Status Organization B', 'status-organization-b');

insert into public.organization_members (organization_id, user_id, role)
values
  ('d8200000-0000-4000-8000-000000000001', 'd8100000-0000-4000-8000-000000000001', 'staff'),
  ('d8200000-0000-4000-8000-000000000002', 'd8100000-0000-4000-8000-000000000002', 'staff');

insert into public.owners (id, organization_id, full_name)
values
  ('d8300000-0000-4000-8000-000000000001', 'd8200000-0000-4000-8000-000000000001', 'Status owner A'),
  ('d8300000-0000-4000-8000-000000000002', 'd8200000-0000-4000-8000-000000000002', 'Status owner B');

insert into public.microchips (id, organization_id, code, status)
values
  ('d8400000-0000-4000-8000-000000000001', 'd8200000-0000-4000-8000-000000000001', '990000000000801', 'implanted'),
  ('d8400000-0000-4000-8000-000000000002', 'd8200000-0000-4000-8000-000000000001', '990000000000802', 'implanted'),
  ('d8400000-0000-4000-8000-000000000003', 'd8200000-0000-4000-8000-000000000001', '990000000000803', 'implanted'),
  ('d8400000-0000-4000-8000-000000000004', 'd8200000-0000-4000-8000-000000000001', '990000000000804', 'implanted'),
  ('d8400000-0000-4000-8000-000000000005', 'd8200000-0000-4000-8000-000000000002', '990000000000805', 'implanted'),
  ('d8400000-0000-4000-8000-000000000006', 'd8200000-0000-4000-8000-000000000001', '990000000000806', 'implanted');

insert into public.animals (id, organization_id, microchip_id, owner_id, name, species, status)
values
  ('d8500000-0000-4000-8000-000000000001', 'd8200000-0000-4000-8000-000000000001', 'd8400000-0000-4000-8000-000000000001', 'd8300000-0000-4000-8000-000000000001', 'Animal status A', 'dog', 'active'),
  ('d8500000-0000-4000-8000-000000000002', 'd8200000-0000-4000-8000-000000000001', 'd8400000-0000-4000-8000-000000000002', 'd8300000-0000-4000-8000-000000000001', 'Animal deceased', 'dog', 'deceased'),
  ('d8500000-0000-4000-8000-000000000003', 'd8200000-0000-4000-8000-000000000001', 'd8400000-0000-4000-8000-000000000003', 'd8300000-0000-4000-8000-000000000001', 'Animal rollback lost', 'dog', 'active'),
  ('d8500000-0000-4000-8000-000000000004', 'd8200000-0000-4000-8000-000000000001', 'd8400000-0000-4000-8000-000000000004', 'd8300000-0000-4000-8000-000000000001', 'Animal rollback found', 'dog', 'lost'),
  ('d8500000-0000-4000-8000-000000000005', 'd8200000-0000-4000-8000-000000000002', 'd8400000-0000-4000-8000-000000000005', 'd8300000-0000-4000-8000-000000000002', 'Animal status B', 'dog', 'active'),
  ('d8500000-0000-4000-8000-000000000006', 'd8200000-0000-4000-8000-000000000001', 'd8400000-0000-4000-8000-000000000006', 'd8300000-0000-4000-8000-000000000001', 'Animal duplicate lost', 'dog', 'active');

set constraints all immediate;
set constraints all deferred;

select ok(to_regprocedure('public.mark_animal_lost(uuid)') is not null, 'mark_animal_lost exists');
select ok(to_regprocedure('public.mark_animal_found(uuid)') is not null, 'mark_animal_found exists');
select ok((select prosecdef from pg_proc where oid = 'public.mark_animal_lost(uuid)'::regprocedure), 'mark_animal_lost is SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.mark_animal_found(uuid)'::regprocedure), 'mark_animal_found is SECURITY DEFINER');
select ok((select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid = 'public.mark_animal_lost(uuid)'::regprocedure), 'mark_animal_lost pins a safe search_path');
select ok((select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid = 'public.mark_animal_found(uuid)'::regprocedure), 'mark_animal_found pins a safe search_path');
select ok(not has_function_privilege('anon', 'public.mark_animal_lost(uuid)', 'execute'), 'anon cannot execute mark_animal_lost');
select ok(not has_function_privilege('anon', 'public.mark_animal_found(uuid)', 'execute'), 'anon cannot execute mark_animal_found');
select ok(has_function_privilege('authenticated', 'public.mark_animal_lost(uuid)', 'execute'), 'authenticated can execute mark_animal_lost');
select ok(has_function_privilege('authenticated', 'public.mark_animal_found(uuid)', 'execute'), 'authenticated can execute mark_animal_found');
select ok(not has_table_privilege('authenticated', 'public.animals', 'update'), 'authenticated direct UPDATE on animals remains denied');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd8100000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$ insert into public.animal_events (animal_id, event_type, title, metadata) values ('d8500000-0000-4000-8000-000000000001', 'status_change', 'Manual status change', '{}'::jsonb) $$,
  '42501', null, 'authenticated cannot insert status_change directly'
);

select is(public.mark_animal_lost('d8500000-0000-4000-8000-000000000001'), 'lost'::public.animal_status, 'active animal transitions to lost');
select is((select status from public.animals where id = 'd8500000-0000-4000-8000-000000000001'), 'lost'::public.animal_status, 'mark lost updates the animal status');
select is((select count(*) from public.animal_events where animal_id = 'd8500000-0000-4000-8000-000000000001' and event_type = 'status_change' and title = 'Animal marcado como perdido'), 1::bigint, 'mark lost creates exactly one lost status event');
select is((select performed_by from public.animal_events where animal_id = 'd8500000-0000-4000-8000-000000000001' and title = 'Animal marcado como perdido'), 'd8100000-0000-4000-8000-000000000001'::uuid, 'lost event derives performed_by from auth.uid');
select is(public.mark_animal_found('d8500000-0000-4000-8000-000000000001'), 'active'::public.animal_status, 'lost animal transitions to active');
select is((select status from public.animals where id = 'd8500000-0000-4000-8000-000000000001'), 'active'::public.animal_status, 'mark found updates the animal status');
select is((select count(*) from public.animal_events where animal_id = 'd8500000-0000-4000-8000-000000000001' and event_type = 'status_change' and title = 'Animal marcado como encontrado'), 1::bigint, 'mark found creates exactly one found status event');
select is((select performed_by from public.animal_events where animal_id = 'd8500000-0000-4000-8000-000000000001' and title = 'Animal marcado como encontrado'), 'd8100000-0000-4000-8000-000000000001'::uuid, 'found event derives performed_by from auth.uid');
select public.mark_animal_lost('d8500000-0000-4000-8000-000000000006');
select throws_ok($$ select public.mark_animal_lost('d8500000-0000-4000-8000-000000000006') $$, 'P0001', 'Transición de estado no disponible.', 'lost cannot be repeated');
select is((select count(*) from public.animal_events where animal_id = 'd8500000-0000-4000-8000-000000000006' and title = 'Animal marcado como perdido'), 1::bigint, 'duplicate lost creates no additional event');
select throws_ok($$ select public.mark_animal_found('d8500000-0000-4000-8000-000000000001') $$, 'P0001', 'Transición de estado no disponible.', 'found cannot be called from active');
select is((select status from public.animals where id = 'd8500000-0000-4000-8000-000000000001'), 'active'::public.animal_status, 'invalid found keeps the animal active');
select throws_ok($$ select public.mark_animal_lost('d8500000-0000-4000-8000-000000000002') $$, 'P0001', 'Transición de estado no disponible.', 'deceased cannot be marked lost');
select throws_ok($$ select public.mark_animal_found('d8500000-0000-4000-8000-000000000002') $$, 'P0001', 'Transición de estado no disponible.', 'deceased cannot be marked found');
select is((select status from public.animals where id = 'd8500000-0000-4000-8000-000000000002'), 'deceased'::public.animal_status, 'deceased animal remains deceased');

select set_config('request.jwt.claim.sub', 'd8100000-0000-4000-8000-000000000001', true);
select throws_ok($$ select public.mark_animal_lost('d8500000-0000-4000-8000-000000000005') $$, 'P0001', 'Animal no disponible.', 'cross-tenant mark lost is rejected');
reset role;
select is((select status from public.animals where id = 'd8500000-0000-4000-8000-000000000005'), 'active'::public.animal_status, 'cross-tenant lost leaves Organization B unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd8100000-0000-4000-8000-000000000001', true);
select throws_ok($$ select public.mark_animal_found('d8500000-0000-4000-8000-000000000005') $$, 'P0001', 'Animal no disponible.', 'cross-tenant mark found is rejected');
reset role;
select is((select status from public.animals where id = 'd8500000-0000-4000-8000-000000000005'), 'active'::public.animal_status, 'cross-tenant found leaves Organization B unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd8100000-0000-4000-8000-000000000001', true);
select throws_ok($$ select public.mark_animal_lost('d8500000-0000-4000-8000-000000000099') $$, 'P0001', 'Animal no disponible.', 'unknown animal is rejected by mark lost');
select throws_ok($$ select public.mark_animal_found('d8500000-0000-4000-8000-000000000099') $$, 'P0001', 'Animal no disponible.', 'unknown animal is rejected by mark found');
select ok(pg_get_functiondef('public.mark_animal_lost(uuid)'::regprocedure) ilike '%for update%', 'mark_animal_lost locks the animal row');
select ok(pg_get_functiondef('public.mark_animal_found(uuid)'::regprocedure) ilike '%for update%', 'mark_animal_found locks the animal row');

reset role;

create function pg_temp.fail_status_change_event()
returns trigger
language plpgsql
as $$
begin
  if new.title in ('Animal marcado como perdido', 'Animal marcado como encontrado') then
    raise exception 'forced status event failure' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger fail_status_change_event
before insert on public.animal_events
for each row execute function pg_temp.fail_status_change_event();

select throws_ok($$ select public.mark_animal_lost('d8500000-0000-4000-8000-000000000003') $$, 'P0001', 'forced status event failure', 'lost rolls back when its event insert fails');
select is((select status from public.animals where id = 'd8500000-0000-4000-8000-000000000003'), 'active'::public.animal_status, 'lost rollback restores active status');
select is((select count(*) from public.animal_events where animal_id = 'd8500000-0000-4000-8000-000000000003' and event_type = 'status_change'), 0::bigint, 'lost rollback leaves no status event');
select throws_ok($$ select public.mark_animal_found('d8500000-0000-4000-8000-000000000004') $$, 'P0001', 'forced status event failure', 'found rolls back when its event insert fails');
select is((select status from public.animals where id = 'd8500000-0000-4000-8000-000000000004'), 'lost'::public.animal_status, 'found rollback restores lost status');
select is((select count(*) from public.animal_events where animal_id = 'd8500000-0000-4000-8000-000000000004' and event_type = 'status_change'), 0::bigint, 'found rollback leaves no status event');

select * from finish();
rollback;
