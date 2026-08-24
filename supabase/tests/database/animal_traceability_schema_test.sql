begin;
select plan(21);

select has_table('public', 'organizations', 'organizations exists');
select has_table('public', 'organization_members', 'organization_members exists');
select has_table('public', 'owners', 'owners exists');
select has_table('public', 'microchips', 'microchips exists');
select has_table('public', 'animals', 'animals exists');
select has_table('public', 'animal_events', 'animal_events exists');
select has_table('public', 'recovery_reports', 'recovery_reports exists');

select col_is_unique('public', 'microchips', 'code', 'microchips.code is unique');

select throws_ok(
  $$
    insert into public.microchips (organization_id, code)
    values ('11111111-1111-4111-8111-111111111111', 'not-a-chip')
  $$,
  '23514',
  'new row for relation "microchips" violates check constraint "microchips_code_format_check"',
  'microchips.code rejects non-numeric values'
);

select lives_ok(
  $$
    insert into public.microchips (organization_id, code)
    values ('11111111-1111-4111-8111-111111111111', '9900000153001689')
  $$,
  'microchips.code accepts the physical-chip numeric format'
);

select col_is_unique('public', 'animals', 'microchip_id', 'animals.microchip_id is unique');

select throws_ok(
  $$
    do $test$
    begin
      insert into public.organizations (id, name, slug)
      values
        ('30000000-0000-4000-8000-000000000001', 'Owner organization', 'owner-organization'),
        ('30000000-0000-4000-8000-000000000002', 'Animal organization', 'animal-organization');
      insert into public.owners (id, organization_id, full_name)
      values ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Owner from another organization');
      insert into public.microchips (id, organization_id, code, status)
      values ('32000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '990000000000001', 'available');
      insert into public.animals (organization_id, microchip_id, owner_id, name, species)
      values ('30000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Invalid owner', 'dog');
    end
    $test$
  $$,
  '23503',
  'insert or update on table "animals" violates foreign key constraint "animals_owner_same_organization_fkey"',
  'DR-008 rejects an owner from another organization'
);

select throws_ok(
  $$
    do $test$
    begin
      insert into public.organizations (id, name, slug)
      values
        ('40000000-0000-4000-8000-000000000001', 'Chip organization', 'chip-organization'),
        ('40000000-0000-4000-8000-000000000002', 'Animal organization two', 'animal-organization-two');
      insert into public.owners (id, organization_id, full_name)
      values ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Local owner');
      insert into public.microchips (id, organization_id, code, status)
      values ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '990000000000002', 'available');
      insert into public.animals (organization_id, microchip_id, owner_id, name, species)
      values ('40000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Invalid chip', 'dog');
    end
    $test$
  $$,
  '23503',
  'insert or update on table "animals" violates foreign key constraint "animals_microchip_same_organization_fkey"',
  'DR-008 rejects a microchip from another organization'
);

select throws_ok(
  $$
    do $test$
    begin
      insert into public.organizations (id, name, slug)
      values ('50000000-0000-4000-8000-000000000001', 'Available organization', 'available-organization');
      insert into public.owners (id, organization_id, full_name)
      values ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Available owner');
      insert into public.microchips (id, organization_id, code, status)
      values ('52000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '990000000000003', 'available');
      insert into public.animals (organization_id, microchip_id, owner_id, name, species)
      values ('50000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Invalid available', 'dog');
      set constraints all immediate;
    end
    $test$
  $$,
  '23514',
  'Microchip 52000000-0000-4000-8000-000000000001 with status available must have no animals, found 1',
  'available plus an animal fails at deferred constraint evaluation'
);

select throws_ok(
  $$
    do $test$
    begin
      insert into public.organizations (id, name, slug)
      values ('60000000-0000-4000-8000-000000000001', 'Blocked organization', 'blocked-organization');
      insert into public.owners (id, organization_id, full_name)
      values ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'Blocked owner');
      insert into public.microchips (id, organization_id, code, status)
      values ('62000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '990000000000004', 'blocked');
      insert into public.animals (organization_id, microchip_id, owner_id, name, species)
      values ('60000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'Invalid blocked', 'dog');
      set constraints all immediate;
    end
    $test$
  $$,
  '23514',
  'Microchip 62000000-0000-4000-8000-000000000001 with status blocked must have no animals, found 1',
  'blocked plus an animal fails at deferred constraint evaluation'
);

select throws_ok(
  $$
    do $test$
    begin
      insert into public.organizations (id, name, slug)
      values ('70000000-0000-4000-8000-000000000001', 'Implanted organization', 'implanted-organization');
      insert into public.microchips (id, organization_id, code, status)
      values ('72000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '990000000000005', 'implanted');
      set constraints all immediate;
    end
    $test$
  $$,
  '23514',
  'Microchip 72000000-0000-4000-8000-000000000001 with status implanted must have exactly one animal, found 0',
  'implanted without an animal fails at deferred constraint evaluation'
);

select lives_ok(
  $$
    do $test$
    begin
      insert into public.organizations (id, name, slug)
      values ('80000000-0000-4000-8000-000000000001', 'Valid implanted organization', 'valid-implanted-organization');
      insert into public.owners (id, organization_id, full_name)
      values ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'Valid implanted owner');
      insert into public.microchips (id, organization_id, code, status)
      values ('82000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', '990000000000006', 'implanted');
      insert into public.animals (organization_id, microchip_id, owner_id, name, species)
      values ('80000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'Valid implanted', 'dog');
      set constraints all immediate;
    end
    $test$
  $$,
  'implanted plus exactly one same-organization animal succeeds'
);

set constraints all deferred;

insert into public.organizations (id, name, slug)
values ('90000000-0000-4000-8000-000000000001', 'Unique chip organization', 'unique-chip-organization');
insert into public.owners (id, organization_id, full_name)
values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'First owner'),
  ('91000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'Second owner');
insert into public.microchips (id, organization_id, code, status)
values ('92000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '990000000000007', 'implanted');

select throws_ok(
  $$
    insert into public.animals (organization_id, microchip_id, owner_id, name, species)
    values
      ('90000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'First animal', 'dog'),
      ('90000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'Second animal', 'dog')
  $$,
  '23505',
  'duplicate key value violates unique constraint "animals_microchip_id_key"',
  'two animals cannot use the same microchip'
);

select ok(
  exists (select 1 from public.microchips where code = '990000015300168'),
  'the reserved physical demo chip exists'
);
select is(
  (select status from public.microchips where code = '990000015300168'),
  'available'::public.microchip_status,
  'the reserved physical demo chip is available'
);
select is(
  (select count(*) from public.animals where microchip_id = (select id from public.microchips where code = '990000015300168')),
  0::bigint,
  'the reserved physical demo chip has no animal'
);

select * from finish();
rollback;
