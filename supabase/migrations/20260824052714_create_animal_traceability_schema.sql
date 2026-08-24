create type public.organization_role as enum ('admin', 'staff');
create type public.microchip_status as enum ('available', 'implanted', 'blocked');
create type public.animal_sex as enum ('male', 'female', 'unknown');
create type public.animal_status as enum ('active', 'lost', 'deceased');
create type public.animal_event_type as enum (
  'registration',
  'implantation',
  'vaccination',
  'status_change',
  'note'
);
create type public.recovery_report_status as enum ('pending', 'reviewed', 'closed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.organization_role not null,
  primary key (organization_id, user_id)
);

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  full_name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.microchips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  code text not null unique,
  technology text not null default 'FDX-B',
  frequency_khz numeric not null default 134.2,
  standard text not null default 'ISO 11784/11785',
  batch_code text,
  status public.microchip_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint microchips_code_format_check
    check (code = btrim(code) and code ~ '^[0-9]{10,20}$'),
  unique (organization_id, id)
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  microchip_id uuid not null unique,
  owner_id uuid not null,
  name text not null,
  species text not null,
  breed text,
  sex public.animal_sex not null default 'unknown',
  birth_date date,
  color text,
  status public.animal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint animals_owner_same_organization_fkey
    foreign key (organization_id, owner_id)
    references public.owners (organization_id, id),
  constraint animals_microchip_same_organization_fkey
    foreign key (organization_id, microchip_id)
    references public.microchips (organization_id, id)
);

create table public.animal_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id),
  event_type public.animal_event_type not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  performed_by uuid references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.recovery_reports (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id),
  reporter_name text not null,
  contact text not null,
  message text,
  status public.recovery_report_status not null default 'pending',
  created_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger owners_set_updated_at
before update on public.owners
for each row execute function public.set_updated_at();

create trigger microchips_set_updated_at
before update on public.microchips
for each row execute function public.set_updated_at();

create trigger animals_set_updated_at
before update on public.animals
for each row execute function public.set_updated_at();

create function public.assert_microchip_animal_cardinality_for_chip(chip_id_to_check uuid)
returns void
language plpgsql
as $$
declare
  chip_status public.microchip_status;
  animal_count integer;
begin
  select status into chip_status
  from public.microchips
  where id = chip_id_to_check;

  if not found then
    return;
  end if;

  select count(*) into animal_count
  from public.animals
  where microchip_id = chip_id_to_check;

  if chip_status = 'implanted' and animal_count <> 1 then
    raise exception
      'Microchip % with status implanted must have exactly one animal, found %',
      chip_id_to_check,
      animal_count
      using errcode = '23514';
  end if;

  if chip_status in ('available', 'blocked') and animal_count <> 0 then
    raise exception
      'Microchip % with status % must have no animals, found %',
      chip_id_to_check,
      chip_status,
      animal_count
      using errcode = '23514';
  end if;
end;
$$;

create function public.assert_microchip_animal_cardinality()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'microchips' then
    perform public.assert_microchip_animal_cardinality_for_chip(new.id);
  elsif tg_op = 'insert' then
    perform public.assert_microchip_animal_cardinality_for_chip(new.microchip_id);
  elsif tg_op = 'delete' then
    perform public.assert_microchip_animal_cardinality_for_chip(old.microchip_id);
  else
    perform public.assert_microchip_animal_cardinality_for_chip(old.microchip_id);

    if new.microchip_id is distinct from old.microchip_id then
      perform public.assert_microchip_animal_cardinality_for_chip(new.microchip_id);
    end if;
  end if;

  return null;
end;
$$;

create constraint trigger microchips_enforce_animal_cardinality
after insert or update of status on public.microchips
deferrable initially deferred
for each row execute function public.assert_microchip_animal_cardinality();

create constraint trigger animals_enforce_microchip_cardinality
after insert or update of microchip_id or delete on public.animals
deferrable initially deferred
for each row execute function public.assert_microchip_animal_cardinality();

create index animals_owner_id_idx on public.animals (owner_id);
create index animal_events_animal_id_occurred_at_idx on public.animal_events (animal_id, occurred_at);
create index recovery_reports_animal_id_idx on public.recovery_reports (animal_id);
create index recovery_reports_status_idx on public.recovery_reports (status);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.owners enable row level security;
alter table public.microchips enable row level security;
alter table public.animals enable row level security;
alter table public.animal_events enable row level security;
alter table public.recovery_reports enable row level security;
