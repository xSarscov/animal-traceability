begin;
select plan(38);

insert into auth.users (id, email)
values
  ('f0100000-0000-4000-8000-000000000001', 'staff-inbox-a@example.test'),
  ('f0100000-0000-4000-8000-000000000002', 'staff-inbox-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('f0200000-0000-4000-8000-000000000001', 'Inbox Organization A', 'inbox-organization-a'),
  ('f0200000-0000-4000-8000-000000000002', 'Inbox Organization B', 'inbox-organization-b');

insert into public.organization_members (organization_id, user_id, role)
values
  ('f0200000-0000-4000-8000-000000000001', 'f0100000-0000-4000-8000-000000000001', 'staff'),
  ('f0200000-0000-4000-8000-000000000002', 'f0100000-0000-4000-8000-000000000002', 'staff');

insert into public.owners (id, organization_id, full_name)
values
  ('f0300000-0000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000001', 'Inbox owner A'),
  ('f0300000-0000-4000-8000-000000000002', 'f0200000-0000-4000-8000-000000000002', 'Inbox owner B');

insert into public.microchips (id, organization_id, code, status)
values
  ('f0400000-0000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000001', '990000000001001', 'implanted'),
  ('f0400000-0000-4000-8000-000000000002', 'f0200000-0000-4000-8000-000000000001', '990000000001002', 'implanted'),
  ('f0400000-0000-4000-8000-000000000003', 'f0200000-0000-4000-8000-000000000001', '990000000001003', 'implanted'),
  ('f0400000-0000-4000-8000-000000000004', 'f0200000-0000-4000-8000-000000000001', '990000000001004', 'implanted'),
  ('f0400000-0000-4000-8000-000000000005', 'f0200000-0000-4000-8000-000000000002', '990000000001005', 'implanted'),
  ('f0400000-0000-4000-8000-000000000006', 'f0200000-0000-4000-8000-000000000002', '990000000001006', 'implanted');

insert into public.animals (id, organization_id, microchip_id, owner_id, name, species, status)
values
  ('f0500000-0000-4000-8000-000000000001', 'f0200000-0000-4000-8000-000000000001', 'f0400000-0000-4000-8000-000000000001', 'f0300000-0000-4000-8000-000000000001', 'Inbox pending A', 'dog', 'lost'),
  ('f0500000-0000-4000-8000-000000000002', 'f0200000-0000-4000-8000-000000000001', 'f0400000-0000-4000-8000-000000000002', 'f0300000-0000-4000-8000-000000000001', 'Inbox reviewed A', 'dog', 'lost'),
  ('f0500000-0000-4000-8000-000000000003', 'f0200000-0000-4000-8000-000000000001', 'f0400000-0000-4000-8000-000000000003', 'f0300000-0000-4000-8000-000000000001', 'Inbox closed A', 'dog', 'active'),
  ('f0500000-0000-4000-8000-000000000004', 'f0200000-0000-4000-8000-000000000001', 'f0400000-0000-4000-8000-000000000004', 'f0300000-0000-4000-8000-000000000001', 'Inbox independent A', 'dog', 'active'),
  ('f0500000-0000-4000-8000-000000000005', 'f0200000-0000-4000-8000-000000000002', 'f0400000-0000-4000-8000-000000000005', 'f0300000-0000-4000-8000-000000000002', 'Inbox pending B', 'dog', 'lost'),
  ('f0500000-0000-4000-8000-000000000006', 'f0200000-0000-4000-8000-000000000002', 'f0400000-0000-4000-8000-000000000006', 'f0300000-0000-4000-8000-000000000002', 'Inbox reviewed B', 'dog', 'lost');

insert into public.recovery_reports (id, animal_id, reporter_name, contact, status)
values
  ('f0600000-0000-4000-8000-000000000001', 'f0500000-0000-4000-8000-000000000001', 'Reporter pending A', 'pending-a@example.test', 'pending'),
  ('f0600000-0000-4000-8000-000000000002', 'f0500000-0000-4000-8000-000000000002', 'Reporter reviewed A', 'reviewed-a@example.test', 'reviewed'),
  ('f0600000-0000-4000-8000-000000000003', 'f0500000-0000-4000-8000-000000000003', 'Reporter closed A', 'closed-a@example.test', 'closed'),
  ('f0600000-0000-4000-8000-000000000004', 'f0500000-0000-4000-8000-000000000004', 'Reporter independent A', 'independent-a@example.test', 'reviewed'),
  ('f0600000-0000-4000-8000-000000000005', 'f0500000-0000-4000-8000-000000000005', 'Reporter pending B', 'pending-b@example.test', 'pending'),
  ('f0600000-0000-4000-8000-000000000006', 'f0500000-0000-4000-8000-000000000006', 'Reporter reviewed B', 'reviewed-b@example.test', 'reviewed');

set constraints all immediate;
set constraints all deferred;

select ok(to_regprocedure('public.mark_recovery_report_reviewed(uuid)') is not null, 'mark_recovery_report_reviewed exists');
select ok(to_regprocedure('public.close_recovery_report(uuid)') is not null, 'close_recovery_report exists');
select ok((select prosecdef from pg_proc where oid = 'public.mark_recovery_report_reviewed(uuid)'::regprocedure), 'mark recovery report reviewed is SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.close_recovery_report(uuid)'::regprocedure), 'close recovery report is SECURITY DEFINER');
select ok((select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid = 'public.mark_recovery_report_reviewed(uuid)'::regprocedure), 'review RPC pins a safe search_path');
select ok((select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid = 'public.close_recovery_report(uuid)'::regprocedure), 'close RPC pins a safe search_path');
select ok(not has_function_privilege('public', 'public.mark_recovery_report_reviewed(uuid)', 'execute'), 'PUBLIC has no review RPC execution');
select ok(not has_function_privilege('public', 'public.close_recovery_report(uuid)', 'execute'), 'PUBLIC has no close RPC execution');
select ok(not has_function_privilege('anon', 'public.mark_recovery_report_reviewed(uuid)', 'execute'), 'anon cannot review reports');
select ok(not has_function_privilege('anon', 'public.close_recovery_report(uuid)', 'execute'), 'anon cannot close reports');
select ok(has_function_privilege('authenticated', 'public.mark_recovery_report_reviewed(uuid)', 'execute'), 'authenticated can review reports');
select ok(has_function_privilege('authenticated', 'public.close_recovery_report(uuid)', 'execute'), 'authenticated can close reports');
select ok(not has_table_privilege('authenticated', 'public.recovery_reports', 'update'), 'authenticated has no direct UPDATE on recovery reports');
select ok(not has_table_privilege('anon', 'public.recovery_reports', 'select'), 'anon has no direct SELECT on recovery reports');
select ok(not has_table_privilege('anon', 'public.recovery_reports', 'update'), 'anon has no direct UPDATE on recovery reports');
select ok(not has_table_privilege('anon', 'public.recovery_reports', 'delete'), 'anon has no direct DELETE on recovery reports');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0100000-0000-4000-8000-000000000001', true);
select throws_ok($$ update public.recovery_reports set status = 'reviewed' where id = 'f0600000-0000-4000-8000-000000000001' $$, '42501', null, 'authenticated cannot update a report directly');
select throws_ok($$ select public.close_recovery_report('f0600000-0000-4000-8000-000000000001') $$, 'P0001', 'Transición de reporte no disponible.', 'pending report cannot close directly');
select is((select status from public.recovery_reports where id = 'f0600000-0000-4000-8000-000000000001'), 'pending'::public.recovery_report_status, 'pending report remains pending after invalid close');
select is(public.mark_recovery_report_reviewed('f0600000-0000-4000-8000-000000000001'), 'reviewed'::public.recovery_report_status, 'pending report transitions to reviewed');
select is((select status from public.recovery_reports where id = 'f0600000-0000-4000-8000-000000000001'), 'reviewed'::public.recovery_report_status, 'review RPC persists reviewed');
select is((select status from public.animals where id = 'f0500000-0000-4000-8000-000000000001'), 'lost'::public.animal_status, 'reviewing a report does not change animal status');
select is(public.close_recovery_report('f0600000-0000-4000-8000-000000000002'), 'closed'::public.recovery_report_status, 'reviewed report transitions to closed');
select is((select status from public.recovery_reports where id = 'f0600000-0000-4000-8000-000000000002'), 'closed'::public.recovery_report_status, 'close RPC persists closed');
select throws_ok($$ select public.close_recovery_report('f0600000-0000-4000-8000-000000000005') $$, 'P0001', 'Reporte no disponible.', 'cross-tenant close is rejected without disclosure');
select throws_ok($$ select public.mark_recovery_report_reviewed('f0600000-0000-4000-8000-000000000001') $$, 'P0001', 'Transición de reporte no disponible.', 'reviewed report cannot be reviewed twice');
select throws_ok($$ select public.mark_recovery_report_reviewed('f0600000-0000-4000-8000-000000000003') $$, 'P0001', 'Transición de reporte no disponible.', 'closed report cannot be reviewed');
select throws_ok($$ select public.close_recovery_report('f0600000-0000-4000-8000-000000000003') $$, 'P0001', 'Transición de reporte no disponible.', 'closed report cannot close again');
select is((select status from public.recovery_reports where id = 'f0600000-0000-4000-8000-000000000003'), 'closed'::public.recovery_report_status, 'closed is terminal');
select throws_ok($$ select public.mark_recovery_report_reviewed('f0600000-0000-4000-8000-000000000005') $$, 'P0001', 'Reporte no disponible.', 'cross-tenant review is rejected without disclosure');
reset role;
select is((select status from public.recovery_reports where id = 'f0600000-0000-4000-8000-000000000005'), 'pending'::public.recovery_report_status, 'cross-tenant review leaves report unchanged');
select is((select status from public.recovery_reports where id = 'f0600000-0000-4000-8000-000000000006'), 'reviewed'::public.recovery_report_status, 'cross-tenant close leaves report unchanged');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0100000-0000-4000-8000-000000000001', true);
select throws_ok($$ select public.mark_recovery_report_reviewed('f0600000-0000-4000-8000-000000000099') $$, 'P0001', 'Reporte no disponible.', 'unknown report review is rejected');
select throws_ok($$ select public.close_recovery_report('f0600000-0000-4000-8000-000000000099') $$, 'P0001', 'Reporte no disponible.', 'unknown report close is rejected');
select ok(pg_get_functiondef('public.mark_recovery_report_reviewed(uuid)'::regprocedure) ilike '%for update%', 'review RPC locks the report row');
select ok(pg_get_functiondef('public.close_recovery_report(uuid)'::regprocedure) ilike '%for update%', 'close RPC locks the report row');
select is(public.close_recovery_report('f0600000-0000-4000-8000-000000000004'), 'closed'::public.recovery_report_status, 'reviewed report closes even when animal is active');
select is((select status from public.animals where id = 'f0500000-0000-4000-8000-000000000004'), 'active'::public.animal_status, 'closing a report does not change an active animal');

reset role;
select * from finish();
rollback;
