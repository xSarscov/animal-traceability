begin;
select plan(46);

insert into auth.users (id, email)
values
  ('c0000000-0000-4000-8000-000000000001', 'staff-registration-a@example.test'),
  ('c0000000-0000-4000-8000-000000000002', 'staff-registration-b@example.test');

insert into public.organizations (id, name, slug)
values
  ('c1000000-0000-4000-8000-000000000001', 'Registration Organization A', 'registration-organization-a'),
  ('c1000000-0000-4000-8000-000000000002', 'Registration Organization B', 'registration-organization-b');

insert into public.organization_members (organization_id, user_id, role)
values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'staff'),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'staff');

insert into public.owners (id, organization_id, full_name)
values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Existing owner A'),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'Owner B');

insert into public.microchips (id, organization_id, code, status)
values
  ('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '990000000000601', 'available'),
  ('c3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', '990000000000602', 'available'),
  ('c3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', '990000000000603', 'available'),
  ('c3000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', '990000000000604', 'blocked'),
  ('c3000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', '990000000000605', 'available'),
  ('c3000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', '990000000000606', 'available'),
  ('c3000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000001', '990000000000607', 'implanted');

insert into public.animals (organization_id, microchip_id, owner_id, name, species)
values (
  'c1000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000007',
  'c2000000-0000-4000-8000-000000000001',
  'Existing implanted animal',
  'dog'
);
set constraints all immediate;
set constraints all deferred;

select ok(
  to_regprocedure('public.register_animal_with_chip(text,text,text,text,public.animal_sex,date,text,uuid,text,text,text,text)') is not null,
  'register_animal_with_chip exists'
);
select ok(
  (select prosecdef from pg_proc where oid = to_regprocedure('public.register_animal_with_chip(text,text,text,text,public.animal_sex,date,text,uuid,text,text,text,text)')),
  'register_animal_with_chip is SECURITY DEFINER'
);
select ok(
  (select proconfig @> array['search_path=pg_catalog, public'] from pg_proc where oid = to_regprocedure('public.register_animal_with_chip(text,text,text,text,public.animal_sex,date,text,uuid,text,text,text,text)')),
  'register_animal_with_chip pins a safe search_path'
);
select ok(
  not has_function_privilege('anon', 'public.register_animal_with_chip(text,text,text,text,public.animal_sex,date,text,uuid,text,text,text,text)', 'execute'),
  'anon cannot execute register_animal_with_chip'
);
select ok(
  has_function_privilege('authenticated', 'public.register_animal_with_chip(text,text,text,text,public.animal_sex,date,text,uuid,text,text,text,text)', 'execute'),
  'authenticated can execute register_animal_with_chip'
);
select ok(
  not has_table_privilege('authenticated', 'public.animals', 'insert, update, delete'),
  'authenticated direct writes to animals remain denied'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.register_animal_with_chip(
      ' 990000000000601 ', ' Luna ', ' Perro ', null, 'female', null, ' Negro ',
      null, ' Propietario nuevo ', ' 5555 ', 'luna@example.test', null
    )
  $$,
  'staff A registers an available chip with a new owner'
);
select is(
  (select count(*) from public.owners where full_name = 'Propietario nuevo'),
  1::bigint,
  'new-owner registration creates exactly one owner'
);
select is(
  (select count(*) from public.animals where name = 'Luna'),
  1::bigint,
  'new-owner registration creates exactly one animal'
);
select is(
  (select status from public.microchips where code = '990000000000601'),
  'implanted'::public.microchip_status,
  'new-owner registration implants the microchip'
);
select is(
  (select count(*) from public.animals as animal join public.owners as owner on owner.id = animal.owner_id join public.microchips as chip on chip.id = animal.microchip_id where animal.name = 'Luna' and animal.organization_id = chip.organization_id and animal.organization_id = owner.organization_id),
  1::bigint,
  'new-owner registration preserves DR-008 organization consistency'
);
select is(
  (select count(*) from public.animal_events as event join public.animals as animal on animal.id = event.animal_id where animal.name = 'Luna' and event.event_type in ('registration', 'implantation')),
  2::bigint,
  'new-owner registration creates the two initial events'
);
select is(
  (select count(*) from public.animal_events as event join public.animals as animal on animal.id = event.animal_id where animal.name = 'Luna' and event.performed_by = 'c0000000-0000-4000-8000-000000000001'),
  2::bigint,
  'initial events derive performed_by from auth.uid()'
);

select lives_ok(
  $$
    select public.register_animal_with_chip(
      '990000000000602', 'Max', 'Perro', null, 'male', null, null,
      'c2000000-0000-4000-8000-000000000001', 'ignored', null, null, null
    )
  $$,
  'staff A registers an available chip with an existing owner'
);
select is(
  (select count(*) from public.owners where organization_id = 'c1000000-0000-4000-8000-000000000001'),
  2::bigint,
  'existing-owner registration creates no additional owner'
);
select is(
  (select owner_id from public.animals where name = 'Max'),
  'c2000000-0000-4000-8000-000000000001'::uuid,
  'existing-owner registration keeps the selected owner'
);

select throws_ok(
  $$
    select public.register_animal_with_chip(
      '990000000000603', 'Cross owner', 'Perro', null, 'unknown', null, null,
      'c2000000-0000-4000-8000-000000000002', 'must rollback', null, null, null
    )
  $$,
  'P0001', 'Propietario no disponible.',
  'cross-tenant owner is rejected'
);
select is((select status from public.microchips where code = '990000000000603'), 'available'::public.microchip_status, 'cross-tenant owner rollback keeps chip available');
select is((select count(*) from public.animals where name = 'Cross owner'), 0::bigint, 'cross-tenant owner rollback creates no animal');
select is((select count(*) from public.owners where full_name = 'must rollback'), 0::bigint, 'cross-tenant owner rollback leaves no orphan owner');
select is((select count(*) from public.animal_events where title in ('Animal registrado', 'Microchip implantado') and animal_id in (select id from public.animals where name = 'Cross owner')), 0::bigint, 'cross-tenant owner rollback leaves no events');

select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$
    select public.register_animal_with_chip(
      '990000000000605', 'Cross chip', 'Perro', null, 'unknown', null, null,
      null, 'not allowed', null, null, null
    )
  $$,
  'P0001', 'Microchip no disponible para registro.',
  'cross-tenant microchip is rejected without revealing ownership'
);
reset role;
select is((select status from public.microchips where code = '990000000000605'), 'available'::public.microchip_status, 'cross-tenant microchip has no side effect');
select is((select count(*) from public.animals where name = 'Cross chip'), 0::bigint, 'cross-tenant microchip creates no animal');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$
    select public.register_animal_with_chip(
      '990000000000604', 'Blocked animal', 'Perro', null, 'unknown', null, null,
      null, 'blocked owner', null, null, null
    )
  $$,
  'P0001', 'Microchip no disponible para registro.',
  'blocked microchip is rejected'
);
select is((select status from public.microchips where code = '990000000000604'), 'blocked'::public.microchip_status, 'blocked microchip stays blocked');
select is((select count(*) from public.owners where full_name = 'blocked owner'), 0::bigint, 'blocked microchip creates no owner');

select throws_ok(
  $$
    select public.register_animal_with_chip(
      '990000000000607', 'Again implanted', 'Perro', null, 'unknown', null, null,
      null, 'second owner', null, null, null
    )
  $$,
  'P0001', 'Microchip no disponible para registro.',
  'implanted microchip is rejected'
);
select is((select count(*) from public.animals where microchip_id = 'c3000000-0000-4000-8000-000000000007'), 1::bigint, 'implanted microchip retains exactly one animal');

select throws_ok(
  $$
    select public.register_animal_with_chip(
      '990000000000699', 'Unknown chip', 'Perro', null, 'unknown', null, null,
      null, 'unknown owner', null, null, null
    )
  $$,
  'P0001', 'Microchip no disponible para registro.',
  'unknown microchip is rejected'
);
select is((select count(*) from public.owners where full_name = 'unknown owner'), 0::bigint, 'unknown microchip creates no owner');

select throws_ok($$ select public.register_animal_with_chip('990000000000606', ' ', 'Perro', null, 'unknown', null, null, null, 'invalid owner', null, null, null) $$, '22023', 'Datos del animal no válidos.', 'empty animal name is rejected by the RPC');
select throws_ok($$ select public.register_animal_with_chip('990000000000606', 'Valid', ' ', null, 'unknown', null, null, null, 'invalid owner', null, null, null) $$, '22023', 'Datos del animal no válidos.', 'empty species is rejected by the RPC');
select throws_ok($$ select public.register_animal_with_chip('990000000000606', 'Valid', 'Perro', null, 'unknown', null, null, null, ' ', null, null, null) $$, '22023', 'Datos del propietario no válidos.', 'new owner without a full name is rejected by the RPC');
select throws_ok($$ select public.register_animal_with_chip('invalid-code', 'Valid', 'Perro', null, 'unknown', null, null, null, 'invalid owner', null, null, null) $$, '22023', 'Código de microchip inválido.', 'invalid chip code is rejected by the RPC');
select is((select status from public.microchips where code = '990000000000606'), 'available'::public.microchip_status, 'invalid input keeps the chip available');
select is((select count(*) from public.owners where full_name = 'invalid owner'), 0::bigint, 'invalid input creates no owner');

select throws_ok(
  $$
    select public.register_animal_with_chip(
      '990000000000601', 'Duplicate Luna', 'Perro', null, 'female', null, null,
      null, 'duplicate owner', null, null, null
    )
  $$,
  'P0001', 'Microchip no disponible para registro.',
  'a second registration of the same chip is rejected'
);
select is((select count(*) from public.animals where microchip_id = 'c3000000-0000-4000-8000-000000000001'), 1::bigint, 'same chip still has exactly one animal after duplicate attempt');
select is((select count(*) from public.animal_events where animal_id = (select id from public.animals where microchip_id = 'c3000000-0000-4000-8000-000000000001')), 2::bigint, 'same chip still has exactly two initial events after duplicate attempt');
select is((select count(*) from public.owners where full_name = 'duplicate owner'), 0::bigint, 'duplicate attempt creates no owner');

reset role;

create function public.test_fail_registration_event_for_rollback()
returns trigger
language plpgsql
as $$
begin
  if new.event_type = 'registration'::public.animal_event_type
    and exists (
      select 1
      from public.animals as animal
      where animal.id = new.animal_id
        and animal.name = 'Rollback marker animal'
    ) then
    raise exception 'Forced event failure for rollback test.';
  end if;

  return new;
end;
$$;

create trigger test_fail_registration_event_for_rollback
before insert on public.animal_events
for each row
execute function public.test_fail_registration_event_for_rollback();

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$
    select public.register_animal_with_chip(
      '990000000000606', 'Rollback marker animal', 'Perro', null, 'unknown', null, null,
      null, 'Rollback marker owner', null, null, null
    )
  $$,
  'P0001', 'Forced event failure for rollback test.',
  'event trigger forces a failure after the registration RPC has written rows'
);
select is((select count(*) from public.owners where full_name = 'Rollback marker owner'), 0::bigint, 'forced event failure rolls back the new owner');
select is((select count(*) from public.animals where name = 'Rollback marker animal'), 0::bigint, 'forced event failure rolls back the animal');
select is((select status from public.microchips where code = '990000000000606'), 'available'::public.microchip_status, 'forced event failure restores the chip availability');
select is((select count(*) from public.animal_events where animal_id in (select id from public.animals where name = 'Rollback marker animal')), 0::bigint, 'forced event failure leaves no events');

reset role;
select * from finish();
rollback;
