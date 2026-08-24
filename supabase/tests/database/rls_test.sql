begin;
select plan(53);

insert into auth.users (id, email)
values
  ('e0000000-0000-4000-8000-000000000001', 'admin-a@example.test'),
  ('e0000000-0000-4000-8000-000000000002', 'staff-a@example.test'),
  ('e0000000-0000-4000-8000-000000000003', 'staff-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('d0000000-0000-4000-8000-000000000001', 'Organization A', 'organization-a'),
  ('d0000000-0000-4000-8000-000000000002', 'Organization B', 'organization-b');

insert into public.organization_members (organization_id, user_id, role)
values
  ('d0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'admin'),
  ('d0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'staff'),
  ('d0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000003', 'staff');

insert into public.owners (id, organization_id, full_name)
values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Owner A'),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'Owner B');

insert into public.microchips (id, organization_id, code, status)
values
  ('a1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', '990000000000101', 'implanted'),
  ('a1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', '990000000000102', 'implanted');

insert into public.animals (id, organization_id, microchip_id, owner_id, name, species)
values
  ('b1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Animal A', 'dog'),
  ('b1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'Animal B', 'dog');

set constraints all immediate;

insert into public.animal_events (animal_id, event_type, title)
values
  ('b1000000-0000-4000-8000-000000000001', 'note', 'Event A'),
  ('b1000000-0000-4000-8000-000000000002', 'note', 'Event B');

insert into public.recovery_reports (animal_id, reporter_name, contact)
values
  ('b1000000-0000-4000-8000-000000000001', 'Reporter A', 'contact-a'),
  ('b1000000-0000-4000-8000-000000000002', 'Reporter B', 'contact-b');

select ok(rowsecurity, 'RLS is enabled on ' || tablename)
from pg_tables
where schemaname = 'public'
  and tablename in (
    'organizations',
    'organization_members',
    'owners',
    'microchips',
    'animals',
    'animal_events',
    'recovery_reports'
  )
order by tablename;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$ select slug from public.organizations where id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002') order by slug $$,
  $$ values ('organization-a'::text) $$,
  'Admin A sees Organization A and not Organization B'
);
select results_eq(
  $$ select user_id::text from public.organization_members where organization_id = 'd0000000-0000-4000-8000-000000000001' order by user_id $$,
  $$ values ('e0000000-0000-4000-8000-000000000001'::text), ('e0000000-0000-4000-8000-000000000002'::text) $$,
  'Admin A sees memberships for Organization A only'
);
select results_eq(
  $$ select full_name from public.owners where organization_id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002') order by full_name $$,
  $$ values ('Owner A'::text) $$,
  'Admin A sees owners from Organization A only'
);
select results_eq(
  $$ select code from public.microchips where id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002') order by code $$,
  $$ values ('990000000000101'::text) $$,
  'Admin A sees microchips from Organization A only'
);
select results_eq(
  $$ select name from public.animals where id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by name $$,
  $$ values ('Animal A'::text) $$,
  'Admin A sees animals from Organization A only'
);
select results_eq(
  $$ select title from public.animal_events where animal_id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by title $$,
  $$ values ('Event A'::text) $$,
  'Admin A sees events for Organization A animals only'
);
select results_eq(
  $$ select reporter_name from public.recovery_reports where animal_id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by reporter_name $$,
  $$ values ('Reporter A'::text) $$,
  'Admin A sees recovery reports for Organization A animals only'
);

select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$ select slug from public.organizations where id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002') order by slug $$,
  $$ values ('organization-a'::text) $$,
  'Staff A sees Organization A and not Organization B'
);
select results_eq(
  $$ select user_id::text from public.organization_members where organization_id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002') order by user_id $$,
  $$ values ('e0000000-0000-4000-8000-000000000002'::text) $$,
  'Staff A sees only its own membership'
);
select results_eq(
  $$ select full_name from public.owners where organization_id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002') order by full_name $$,
  $$ values ('Owner A'::text) $$,
  'Staff A sees owners from Organization A only'
);
select results_eq(
  $$ select code from public.microchips where id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002') order by code $$,
  $$ values ('990000000000101'::text) $$,
  'Staff A sees microchips from Organization A only'
);
select results_eq(
  $$ select name from public.animals where id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by name $$,
  $$ values ('Animal A'::text) $$,
  'Staff A sees animals from Organization A only'
);
select results_eq(
  $$ select title from public.animal_events where animal_id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by title $$,
  $$ values ('Event A'::text) $$,
  'Staff A sees events for Organization A animals only'
);
select results_eq(
  $$ select reporter_name from public.recovery_reports where animal_id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by reporter_name $$,
  $$ values ('Reporter A'::text) $$,
  'Staff A sees recovery reports for Organization A animals only'
);

select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000003', true);

select results_eq(
  $$ select slug from public.organizations where id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002') order by slug $$,
  $$ values ('organization-b'::text) $$,
  'Staff B sees Organization B and not Organization A'
);
select results_eq(
  $$ select user_id::text from public.organization_members where organization_id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002') order by user_id $$,
  $$ values ('e0000000-0000-4000-8000-000000000003'::text) $$,
  'Staff B sees only its own membership'
);
select results_eq(
  $$ select full_name from public.owners where organization_id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002') order by full_name $$,
  $$ values ('Owner B'::text) $$,
  'Staff B sees owners from Organization B only'
);
select results_eq(
  $$ select code from public.microchips where id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002') order by code $$,
  $$ values ('990000000000102'::text) $$,
  'Staff B sees microchips from Organization B only'
);
select results_eq(
  $$ select name from public.animals where id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by name $$,
  $$ values ('Animal B'::text) $$,
  'Staff B sees animals from Organization B only'
);
select results_eq(
  $$ select title from public.animal_events where animal_id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by title $$,
  $$ values ('Event B'::text) $$,
  'Staff B sees events for Organization B animals only'
);
select results_eq(
  $$ select reporter_name from public.recovery_reports where animal_id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002') order by reporter_name $$,
  $$ values ('Reporter B'::text) $$,
  'Staff B sees recovery reports for Organization B animals only'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'insert, update, delete'),
  'authenticated has no domain writes on organizations'
);
select ok(
  not has_table_privilege('authenticated', 'public.organization_members', 'insert, update, delete'),
  'authenticated has no domain writes on organization_members'
);
select ok(
  not has_table_privilege('authenticated', 'public.owners', 'insert, update, delete'),
  'authenticated has no domain writes on owners'
);
select ok(
  not has_table_privilege('authenticated', 'public.microchips', 'insert, update, delete'),
  'authenticated cannot insert, update, or delete microchips'
);
select ok(
  not has_table_privilege('authenticated', 'public.animals', 'insert, update, delete'),
  'authenticated cannot insert, update, or delete animals'
);
select ok(
  not has_table_privilege('authenticated', 'public.animal_events', 'insert, update, delete'),
  'authenticated cannot insert, update, or delete animal events'
);
select ok(
  not has_table_privilege('authenticated', 'public.recovery_reports', 'insert, update, delete'),
  'authenticated cannot insert, update, or delete recovery reports'
);

set local role anon;
select throws_ok($$ select * from public.organizations $$, '42501', null, 'anon cannot read organizations');
select throws_ok($$ select * from public.organization_members $$, '42501', null, 'anon cannot read organization memberships');
select throws_ok($$ select * from public.owners $$, '42501', null, 'anon cannot read owners');
select throws_ok($$ select * from public.microchips $$, '42501', null, 'anon cannot read microchips');
select throws_ok($$ select * from public.animals $$, '42501', null, 'anon cannot read animals');
select throws_ok($$ select * from public.animal_events $$, '42501', null, 'anon cannot read animal events');
select throws_ok($$ select * from public.recovery_reports $$, '42501', null, 'anon cannot read recovery reports');

reset role;

select is(
  (select prosecdef from pg_proc where oid = 'public.assert_microchip_animal_cardinality_for_chip(uuid)'::regprocedure),
  true,
  'cardinality checker for a chip is SECURITY DEFINER'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.assert_microchip_animal_cardinality()'::regprocedure),
  true,
  'cardinality trigger function is SECURITY DEFINER'
);
select ok(
  not has_function_privilege('anon', 'public.assert_microchip_animal_cardinality_for_chip(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.assert_microchip_animal_cardinality_for_chip(uuid)', 'execute'),
  'application roles cannot execute the chip cardinality checker directly'
);
select ok(
  not has_function_privilege('anon', 'public.assert_microchip_animal_cardinality()', 'execute')
  and not has_function_privilege('authenticated', 'public.assert_microchip_animal_cardinality()', 'execute'),
  'application roles cannot execute the cardinality trigger directly'
);
select ok(
  not has_function_privilege('anon', 'public.set_updated_at()', 'execute')
  and not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  'application roles cannot execute the updated_at trigger directly'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage')
  and has_schema_privilege('authenticated', 'private', 'usage'),
  'only authenticated has private schema usage required by policies'
);
select ok(
  not has_function_privilege('anon', 'private.is_organization_member(uuid)', 'execute')
  and has_function_privilege('authenticated', 'private.is_organization_member(uuid)', 'execute'),
  'membership helper is restricted to authenticated'
);
select ok(
  not has_function_privilege('anon', 'private.is_organization_admin(uuid)', 'execute')
  and has_function_privilege('authenticated', 'private.is_organization_admin(uuid)', 'execute'),
  'admin helper is restricted to authenticated'
);
select ok(
  not has_function_privilege('anon', 'private.can_access_animal(uuid)', 'execute')
  and has_function_privilege('authenticated', 'private.can_access_animal(uuid)', 'execute'),
  'animal access helper is restricted to authenticated'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000001', true);
select is(
  private.is_organization_member('d0000000-0000-4000-8000-000000000001'),
  true,
  'authenticated helper derives Admin A membership from auth.uid()'
);
select is(
  private.is_organization_member('d0000000-0000-4000-8000-000000000002'),
  false,
  'authenticated helper denies an organization outside the current JWT identity'
);

select * from finish();
rollback;
