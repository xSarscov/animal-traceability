begin;
select plan(45);

insert into public.organizations (id, name, slug)
values ('e9200000-0000-4000-8000-000000000001', 'Public Recovery Test', 'public-recovery-test');

insert into public.owners (id, organization_id, full_name, phone, email, address)
values ('e9300000-0000-4000-8000-000000000001', 'e9200000-0000-4000-8000-000000000001', 'PRIVATE OWNER CANARY', 'PRIVATE PHONE CANARY', 'private-canary@example.test', 'PRIVATE ADDRESS CANARY');

insert into public.microchips (id, organization_id, code, status)
values
  ('e9400000-0000-4000-8000-000000000001', 'e9200000-0000-4000-8000-000000000001', '990000000000901', 'implanted'),
  ('e9400000-0000-4000-8000-000000000002', 'e9200000-0000-4000-8000-000000000001', '990000000000902', 'implanted'),
  ('e9400000-0000-4000-8000-000000000003', 'e9200000-0000-4000-8000-000000000001', '990000000000903', 'implanted'),
  ('e9400000-0000-4000-8000-000000000004', 'e9200000-0000-4000-8000-000000000001', '990000000000904', 'available'),
  ('e9400000-0000-4000-8000-000000000005', 'e9200000-0000-4000-8000-000000000001', '990000000000905', 'blocked');

insert into public.animals (id, organization_id, microchip_id, owner_id, name, species, breed, sex, color, status)
values
  ('e9500000-0000-4000-8000-000000000001', 'e9200000-0000-4000-8000-000000000001', 'e9400000-0000-4000-8000-000000000001', 'e9300000-0000-4000-8000-000000000001', 'Animal activo público', 'Perro', 'Mestizo', 'male', 'Negro', 'active'),
  ('e9500000-0000-4000-8000-000000000002', 'e9200000-0000-4000-8000-000000000001', 'e9400000-0000-4000-8000-000000000002', 'e9300000-0000-4000-8000-000000000001', 'Animal perdido público', 'Perro', 'Mestizo', 'female', 'Marrón', 'lost'),
  ('e9500000-0000-4000-8000-000000000003', 'e9200000-0000-4000-8000-000000000001', 'e9400000-0000-4000-8000-000000000003', 'e9300000-0000-4000-8000-000000000001', 'Animal fallecido público', 'Gato', null, 'unknown', null, 'deceased');

set constraints all immediate;
set constraints all deferred;

select ok(to_regprocedure('public.get_public_animal_by_chip(text)') is not null, 'get_public_animal_by_chip exists');
select ok(to_regprocedure('public.submit_recovery_report(text,text,text,text)') is not null, 'submit_recovery_report exists');
select ok((select prosecdef from pg_proc where oid = 'public.get_public_animal_by_chip(text)'::regprocedure), 'public lookup is SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.submit_recovery_report(text,text,text,text)'::regprocedure), 'public report submission is SECURITY DEFINER');
select is((select provolatile from pg_proc where oid = 'public.get_public_animal_by_chip(text)'::regprocedure), 's'::"char", 'public lookup is STABLE');
select ok((select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid = 'public.get_public_animal_by_chip(text)'::regprocedure), 'public lookup pins a safe search_path');
select ok((select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid = 'public.submit_recovery_report(text,text,text,text)'::regprocedure), 'public report submission pins a safe search_path');
select ok(not has_function_privilege('public', 'public.get_public_animal_by_chip(text)', 'execute'), 'PUBLIC has no implicit public lookup execution');
select ok(not has_function_privilege('public', 'public.submit_recovery_report(text,text,text,text)', 'execute'), 'PUBLIC has no implicit public report execution');
select ok(has_function_privilege('anon', 'public.get_public_animal_by_chip(text)', 'execute'), 'anon can execute public lookup');
select ok(has_function_privilege('anon', 'public.submit_recovery_report(text,text,text,text)', 'execute'), 'anon can submit public report');
select ok(has_function_privilege('authenticated', 'public.get_public_animal_by_chip(text)', 'execute'), 'authenticated can execute public lookup');
select ok(has_function_privilege('authenticated', 'public.submit_recovery_report(text,text,text,text)', 'execute'), 'authenticated can submit public report');
select ok(not has_table_privilege('anon', 'public.owners', 'select'), 'anon has no direct SELECT owners');
select ok(not has_table_privilege('anon', 'public.animals', 'select'), 'anon has no direct SELECT animals');
select ok(not has_table_privilege('anon', 'public.microchips', 'select'), 'anon has no direct SELECT microchips');
select ok(not has_table_privilege('anon', 'public.recovery_reports', 'select'), 'anon has no direct SELECT recovery reports');
select ok(not has_table_privilege('anon', 'public.recovery_reports', 'insert'), 'anon has no direct INSERT recovery reports');

set local role anon;
select results_eq(
  $$ select chip_code, name, species, breed, sex, color, status from public.get_public_animal_by_chip('990000000000902') $$,
  $$ values ('990000000000902'::text, 'Animal perdido público'::text, 'Perro'::text, 'Mestizo'::text, 'female'::public.animal_sex, 'Marrón'::text, 'lost'::public.animal_status) $$,
  'anon lookup returns exactly the safe lost profile projection'
);
select ok(not ((select row_to_json(result)::text from public.get_public_animal_by_chip('990000000000902') as result) like '%PRIVATE OWNER CANARY%') and not ((select row_to_json(result)::text from public.get_public_animal_by_chip('990000000000902') as result) like '%PRIVATE PHONE CANARY%') and not ((select row_to_json(result)::text from public.get_public_animal_by_chip('990000000000902') as result) like '%private-canary@example.test%') and not ((select row_to_json(result)::text from public.get_public_animal_by_chip('990000000000902') as result) like '%PRIVATE ADDRESS CANARY%'), 'public lookup never exposes owner PII canaries');
select is((select status from public.get_public_animal_by_chip('990000000000901')), 'active'::public.animal_status, 'active animal has a public profile');
select is((select status from public.get_public_animal_by_chip('990000000000903')), 'deceased'::public.animal_status, 'deceased animal has a public profile');
select is((select count(*) from public.get_public_animal_by_chip('990000000000904')), 0::bigint, 'available chip has no public profile');
select is((select count(*) from public.get_public_animal_by_chip('990000000000905')), 0::bigint, 'blocked chip has no public profile');
select is((select count(*) from public.get_public_animal_by_chip('990000000000999')), 0::bigint, 'unknown chip has no public profile');
select is((select count(*) from public.get_public_animal_by_chip('not-valid')), 0::bigint, 'invalid chip has no public profile');
select lives_ok($$ select public.submit_recovery_report('990000000000902', ' Persona pública ', ' contacto@example.test ', ' Mensaje de prueba ') $$, 'anon can submit a report only through the RPC');
reset role;
select is((select count(*) from public.recovery_reports where animal_id = 'e9500000-0000-4000-8000-000000000002'), 1::bigint, 'lost submission creates one recovery report');
select is((select reporter_name from public.recovery_reports where animal_id = 'e9500000-0000-4000-8000-000000000002'), 'Persona pública', 'reporter name is normalized server-side');
select is((select contact from public.recovery_reports where animal_id = 'e9500000-0000-4000-8000-000000000002'), 'contacto@example.test', 'contact is normalized server-side');
select is((select message from public.recovery_reports where animal_id = 'e9500000-0000-4000-8000-000000000002'), 'Mensaje de prueba', 'message is normalized server-side');
select is((select status from public.recovery_reports where animal_id = 'e9500000-0000-4000-8000-000000000002'), 'pending'::public.recovery_report_status, 'public report status is always pending');
select ok((select created_at is not null from public.recovery_reports where animal_id = 'e9500000-0000-4000-8000-000000000002'), 'public report timestamp is server-side');
select is((select prorettype::regtype::text from pg_proc where oid = 'public.submit_recovery_report(text,text,text,text)'::regprocedure), 'void', 'public report RPC does not return a private record');

set local role anon;
select throws_ok($$ select public.submit_recovery_report('990000000000901', 'Persona', 'Contacto', '') $$, 'P0001', 'Reporte no disponible.', 'active animal cannot receive a public report');
select throws_ok($$ select public.submit_recovery_report('990000000000903', 'Persona', 'Contacto', '') $$, 'P0001', 'Reporte no disponible.', 'deceased animal cannot receive a public report');
select throws_ok($$ select public.submit_recovery_report('990000000000999', 'Persona', 'Contacto', '') $$, 'P0001', 'Reporte no disponible.', 'unknown chip cannot receive a public report');
select throws_ok($$ select public.submit_recovery_report('not-valid', 'Persona', 'Contacto', '') $$, 'P0001', 'Reporte no disponible.', 'invalid chip is rejected');
select throws_ok($$ select public.submit_recovery_report('990000000000902', '', 'Contacto', '') $$, 'P0001', 'Reporte no disponible.', 'empty reporter name is rejected');
select throws_ok($$ select public.submit_recovery_report('990000000000902', 'Persona', '', '') $$, 'P0001', 'Reporte no disponible.', 'empty contact is rejected');
select throws_ok($$ select public.submit_recovery_report('990000000000902', repeat('a', 121), 'Contacto', '') $$, 'P0001', 'Reporte no disponible.', 'overlong reporter name is rejected');
select throws_ok($$ select public.submit_recovery_report('990000000000902', 'Persona', repeat('a', 201), '') $$, 'P0001', 'Reporte no disponible.', 'overlong contact is rejected');
select throws_ok($$ select public.submit_recovery_report('990000000000902', 'Persona', 'Contacto', repeat('a', 1001)) $$, 'P0001', 'Reporte no disponible.', 'overlong message is rejected');
select throws_ok($$ select * from public.recovery_reports $$, '42501', null, 'anon still cannot read recovery reports after submission');
reset role;
select ok(pg_get_functiondef('public.submit_recovery_report(text,text,text,text)'::regprocedure) ilike '%for share%', 'report submission locks the lost animal with FOR SHARE');

select * from finish();
rollback;
