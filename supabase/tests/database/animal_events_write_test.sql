begin;
select plan(28);

insert into auth.users (id, email)
values
  ('c7100000-0000-4000-8000-000000000001', 'events-staff-a@example.test'),
  ('c7100000-0000-4000-8000-000000000002', 'events-staff-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('c7200000-0000-4000-8000-000000000001', 'Events Organization A', 'events-organization-a'),
  ('c7200000-0000-4000-8000-000000000002', 'Events Organization B', 'events-organization-b');

insert into public.organization_members (organization_id, user_id, role)
values
  ('c7200000-0000-4000-8000-000000000001', 'c7100000-0000-4000-8000-000000000001', 'staff'),
  ('c7200000-0000-4000-8000-000000000002', 'c7100000-0000-4000-8000-000000000002', 'staff');

insert into public.owners (id, organization_id, full_name)
values
  ('c7300000-0000-4000-8000-000000000001', 'c7200000-0000-4000-8000-000000000001', 'Events Owner A'),
  ('c7300000-0000-4000-8000-000000000002', 'c7200000-0000-4000-8000-000000000002', 'Events Owner B');

insert into public.microchips (id, organization_id, code, status)
values
  ('c7400000-0000-4000-8000-000000000001', 'c7200000-0000-4000-8000-000000000001', '990000000000701', 'implanted'),
  ('c7400000-0000-4000-8000-000000000002', 'c7200000-0000-4000-8000-000000000002', '990000000000702', 'implanted');

insert into public.animals (id, organization_id, microchip_id, owner_id, name, species)
values
  ('c7500000-0000-4000-8000-000000000001', 'c7200000-0000-4000-8000-000000000001', 'c7400000-0000-4000-8000-000000000001', 'c7300000-0000-4000-8000-000000000001', 'Events Animal A', 'dog'),
  ('c7500000-0000-4000-8000-000000000002', 'c7200000-0000-4000-8000-000000000002', 'c7400000-0000-4000-8000-000000000002', 'c7300000-0000-4000-8000-000000000002', 'Events Animal B', 'dog');

set constraints all immediate;

select ok(has_column_privilege('authenticated', 'public.animal_events', 'animal_id', 'insert'), 'authenticated can insert animal_id');
select ok(has_column_privilege('authenticated', 'public.animal_events', 'event_type', 'insert'), 'authenticated can insert event_type');
select ok(has_column_privilege('authenticated', 'public.animal_events', 'title', 'insert'), 'authenticated can insert title');
select ok(has_column_privilege('authenticated', 'public.animal_events', 'description', 'insert'), 'authenticated can insert description');
select ok(has_column_privilege('authenticated', 'public.animal_events', 'metadata', 'insert'), 'authenticated can insert metadata');
select ok(not has_column_privilege('authenticated', 'public.animal_events', 'id', 'insert'), 'authenticated cannot insert event id');
select ok(not has_column_privilege('authenticated', 'public.animal_events', 'performed_by', 'insert'), 'authenticated cannot insert performed_by');
select ok(not has_column_privilege('authenticated', 'public.animal_events', 'occurred_at', 'insert'), 'authenticated cannot insert occurred_at');
select ok(not has_column_privilege('authenticated', 'public.animal_events', 'created_at', 'insert'), 'authenticated cannot insert created_at');
select ok(not has_table_privilege('authenticated', 'public.animal_events', 'update, delete'), 'authenticated has no event update or delete grants');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c7100000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$ insert into public.animal_events (animal_id, event_type, title, description, metadata)
     values ('c7500000-0000-4000-8000-000000000001', 'vaccination', 'Vacunación: Rabia', 'Primera dosis', '{"vaccine":"Rabia"}'::jsonb) $$,
  'staff A can insert vaccination for an accessible animal'
);
select is((select event_type from public.animal_events where title = 'Vacunación: Rabia'), 'vaccination'::public.animal_event_type, 'vaccination event type is stored');
select is((select performed_by from public.animal_events where title = 'Vacunación: Rabia'), 'c7100000-0000-4000-8000-000000000001'::uuid, 'vaccination performed_by is derived from auth.uid');
select ok((select occurred_at is not null from public.animal_events where title = 'Vacunación: Rabia'), 'vaccination occurred_at is server defined');
select ok((select created_at is not null from public.animal_events where title = 'Vacunación: Rabia'), 'vaccination created_at is server defined');

select lives_ok(
  $$ insert into public.animal_events (animal_id, event_type, title, metadata)
     values ('c7500000-0000-4000-8000-000000000001', 'note', 'Nota de prueba', '{}'::jsonb) $$,
  'staff A can insert note for an accessible animal'
);
select is((select performed_by from public.animal_events where title = 'Nota de prueba'), 'c7100000-0000-4000-8000-000000000001'::uuid, 'note performed_by is derived from auth.uid');

select throws_ok($$ insert into public.animal_events (animal_id, event_type, title, metadata) values ('c7500000-0000-4000-8000-000000000001', 'registration', 'Manual registration', '{}'::jsonb) $$, '42501', null, 'staff cannot insert registration manually');
select throws_ok($$ insert into public.animal_events (animal_id, event_type, title, metadata) values ('c7500000-0000-4000-8000-000000000001', 'implantation', 'Manual implantation', '{}'::jsonb) $$, '42501', null, 'staff cannot insert implantation manually');
select throws_ok($$ insert into public.animal_events (animal_id, event_type, title, metadata) values ('c7500000-0000-4000-8000-000000000001', 'status_change', 'Manual status change', '{}'::jsonb) $$, '42501', null, 'staff cannot insert status_change manually');
select throws_ok($$ insert into public.animal_events (animal_id, event_type, title, metadata) values ('c7500000-0000-4000-8000-000000000002', 'note', 'Cross tenant note', '{}'::jsonb) $$, '42501', null, 'staff A cannot insert an event for Organization B animal');
select is((select count(*) from public.animal_events where title = 'Cross tenant note'), 0::bigint, 'cross-tenant event is not created');
select throws_ok($$ update public.animal_events set title = 'Changed' where title = 'Nota de prueba' $$, '42501', null, 'staff cannot update events');
select throws_ok($$ delete from public.animal_events where title = 'Nota de prueba' $$, '42501', null, 'staff cannot delete events');
select throws_ok($$ insert into public.animal_events (animal_id, event_type, title, performed_by, metadata) values ('c7500000-0000-4000-8000-000000000001', 'note', 'Forged audit field', 'c7100000-0000-4000-8000-000000000002', '{}'::jsonb) $$, '42501', null, 'staff cannot set performed_by directly');

select set_config('request.jwt.claim.sub', 'c7100000-0000-4000-8000-000000000002', true);
select results_eq(
  $$ select title from public.animal_events where animal_id in ('c7500000-0000-4000-8000-000000000001', 'c7500000-0000-4000-8000-000000000002') order by title $$,
  $$ select null::text where false $$,
  'staff B cannot read Organization A events after M7 insert policy'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.animal_events $$, '42501', null, 'anon cannot read animal events');
select throws_ok($$ insert into public.animal_events (animal_id, event_type, title, metadata) values ('c7500000-0000-4000-8000-000000000001', 'note', 'Anon note', '{}'::jsonb) $$, '42501', null, 'anon cannot insert animal events');

reset role;
select * from finish();
rollback;
