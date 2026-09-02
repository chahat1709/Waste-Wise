-- Waste-Wise v2 foundation: tenant isolation, RBAC, and the first operational records.
--
-- Apply this migration through the Supabase CLI or Dashboard SQL editor. Browser clients
-- use only the publishable key; all provisioning, device ingestion, and routing-provider
-- access stays in trusted server-side services.

create extension if not exists pgcrypto;

create type public.app_role as enum ('driver', 'dispatcher', 'admin');
create type public.shift_status as enum ('scheduled', 'active', 'paused', 'completed', 'cancelled');
create type public.route_status as enum ('draft', 'planned', 'published', 'in_progress', 'completed', 'cancelled');
create type public.route_stop_status as enum ('pending', 'arrived', 'collected', 'inaccessible', 'damaged', 'not_found');
create type public.vehicle_status as enum ('available', 'assigned', 'in_service', 'maintenance', 'retired');
create type public.alert_severity as enum ('info', 'warning', 'high', 'critical');
create type public.alert_status as enum ('open', 'acknowledged', 'resolved', 'dismissed');
create type public.collection_outcome as enum ('collected', 'inaccessible', 'damaged', 'not_found');
create type public.hazard_kind as enum ('road_blocked', 'flooding', 'accident', 'unsafe_access', 'other');

create schema if not exists app_private;
revoke all on schema app_private from public;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  phone_e164 text,
  default_role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (tenant_id, user_id, role)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  registration_number text not null,
  status public.vehicle_status not null default 'available',
  max_weight_kg numeric(10,2) not null check (max_weight_kg > 0),
  max_volume_m3 numeric(10,2) not null check (max_volume_m3 > 0),
  height_m numeric(5,2) check (height_m > 0),
  width_m numeric(5,2) check (width_m > 0),
  length_m numeric(5,2) check (length_m > 0),
  gross_weight_kg numeric(10,2) check (gross_weight_kg > 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, external_id),
  unique (tenant_id, registration_number)
);

create table public.bins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  name text not null,
  address text,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  capacity_kg numeric(10,2) check (capacity_kg > 0),
  capacity_m3 numeric(10,2) check (capacity_m3 > 0),
  service_minutes integer not null default 3 check (service_minutes between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bin_id uuid unique references public.bins(id) on delete set null,
  external_id text not null,
  credential_key_id text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_id),
  unique (tenant_id, credential_key_id)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete restrict,
  status public.shift_status not null default 'scheduled',
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz,
  clocked_in_at timestamptz,
  clocked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_at is null or scheduled_end_at > scheduled_start_at),
  check (clocked_out_at is null or clocked_in_at is null or clocked_out_at >= clocked_in_at)
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  external_id text not null,
  status public.route_status not null default 'draft',
  planned_distance_m integer check (planned_distance_m >= 0),
  planned_duration_s integer check (planned_duration_s >= 0),
  routing_provider text,
  routing_request_reference text,
  route_geometry jsonb,
  generated_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  bin_id uuid not null references public.bins(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  status public.route_stop_status not null default 'pending',
  planned_arrival_at timestamptz,
  completed_at timestamptz,
  skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, sequence),
  unique (route_id, bin_id)
);

create table public.collection_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  route_stop_id uuid not null references public.route_stops(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  outcome public.collection_outcome not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  accuracy_m numeric(10,2) not null check (accuracy_m > 0 and accuracy_m <= 10000),
  note text check (char_length(note) <= 500),
  idempotency_key uuid not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table public.hazard_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  kind public.hazard_kind not null,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  accuracy_m numeric(10,2) not null check (accuracy_m > 0 and accuracy_m <= 10000),
  note text not null check (char_length(trim(note)) between 3 and 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create table public.sos_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete restrict,
  raised_by uuid not null references public.profiles(id) on delete restrict,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  accuracy_m numeric(10,2) not null check (accuracy_m > 0 and accuracy_m <= 10000),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  idempotency_key uuid not null,
  unique (tenant_id, idempotency_key)
);

create table public.device_telemetry (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  sequence bigint not null check (sequence >= 0),
  fill_percent numeric(5,2) check (fill_percent between 0 and 100),
  weight_kg numeric(10,2) check (weight_kg >= 0),
  smoke_detected boolean,
  temperature_celsius numeric(6,2) check (temperature_celsius between -50 and 150),
  battery_percent numeric(5,2) check (battery_percent between 0 and 100),
  raw_payload jsonb,
  check (
    fill_percent is not null or weight_kg is not null or smoke_detected is not null
    or temperature_celsius is not null or battery_percent is not null
  ),
  unique (device_id, sequence)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bin_id uuid references public.bins(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  severity public.alert_severity not null,
  status public.alert_status not null default 'open',
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text not null check (char_length(trim(description)) between 3 and 1000),
  raised_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.payroll_exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null check (status in ('queued', 'generated', 'failed')),
  storage_path text,
  generated_by uuid not null references public.profiles(id) on delete restrict,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index profiles_tenant_idx on public.profiles (tenant_id, is_active);
create index user_roles_tenant_user_idx on public.user_roles (tenant_id, user_id);
create index bins_tenant_active_idx on public.bins (tenant_id, is_active);
create index devices_tenant_bin_idx on public.devices (tenant_id, bin_id);
create index shifts_tenant_driver_status_idx on public.shifts (tenant_id, driver_id, status);
create index routes_tenant_shift_idx on public.routes (tenant_id, shift_id, status);
create index route_stops_tenant_route_idx on public.route_stops (tenant_id, route_id, sequence);
create index collection_events_tenant_driver_idx on public.collection_events (tenant_id, driver_id, recorded_at desc);
create index hazards_tenant_active_idx on public.hazard_reports (tenant_id, is_active, created_at desc);
create index sos_events_tenant_created_idx on public.sos_events (tenant_id, created_at desc);
create index telemetry_device_observed_idx on public.device_telemetry (device_id, observed_at desc);
create index telemetry_tenant_observed_idx on public.device_telemetry (tenant_id, observed_at desc);
create index alerts_tenant_status_idx on public.alerts (tenant_id, status, raised_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at before update on public.tenants
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles
for each row execute function public.set_updated_at();
create trigger bins_set_updated_at before update on public.bins
for each row execute function public.set_updated_at();
create trigger devices_set_updated_at before update on public.devices
for each row execute function public.set_updated_at();
create trigger shifts_set_updated_at before update on public.shifts
for each row execute function public.set_updated_at();
create trigger routes_set_updated_at before update on public.routes
for each row execute function public.set_updated_at();
create trigger route_stops_set_updated_at before update on public.route_stops
for each row execute function public.set_updated_at();

-- Prevent a tenant-owned row from pointing at a record belonging to another tenant.
-- Foreign keys ensure existence; this trigger adds the required same-tenant invariant.
create or replace function app_private.enforce_tenant_references()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'user_roles' then
    if not exists (select 1 from public.profiles where id = new.user_id and tenant_id = new.tenant_id) then
      raise exception 'user role must reference a profile in the same tenant';
    end if;
    if new.created_by is not null and not exists (select 1 from public.profiles where id = new.created_by and tenant_id = new.tenant_id) then
      raise exception 'user role creator must belong to the same tenant';
    end if;
  elsif tg_table_name = 'devices' and new.bin_id is not null then
    if not exists (select 1 from public.bins where id = new.bin_id and tenant_id = new.tenant_id) then
      raise exception 'device bin must belong to the same tenant';
    end if;
  elsif tg_table_name = 'shifts' then
    if not exists (select 1 from public.profiles where id = new.driver_id and tenant_id = new.tenant_id) then
      raise exception 'shift driver must belong to the same tenant';
    end if;
    if new.vehicle_id is not null and not exists (select 1 from public.vehicles where id = new.vehicle_id and tenant_id = new.tenant_id) then
      raise exception 'shift vehicle must belong to the same tenant';
    end if;
  elsif tg_table_name = 'routes' then
    if new.shift_id is not null and not exists (select 1 from public.shifts where id = new.shift_id and tenant_id = new.tenant_id) then
      raise exception 'route shift must belong to the same tenant';
    end if;
    if new.created_by is not null and not exists (select 1 from public.profiles where id = new.created_by and tenant_id = new.tenant_id) then
      raise exception 'route creator must belong to the same tenant';
    end if;
  elsif tg_table_name = 'route_stops' then
    if not exists (select 1 from public.routes where id = new.route_id and tenant_id = new.tenant_id) then
      raise exception 'route stop route must belong to the same tenant';
    end if;
    if not exists (select 1 from public.bins where id = new.bin_id and tenant_id = new.tenant_id) then
      raise exception 'route stop bin must belong to the same tenant';
    end if;
  elsif tg_table_name = 'collection_events' then
    if not exists (select 1 from public.route_stops where id = new.route_stop_id and tenant_id = new.tenant_id) then
      raise exception 'collection event route stop must belong to the same tenant';
    end if;
    if not exists (select 1 from public.profiles where id = new.driver_id and tenant_id = new.tenant_id) then
      raise exception 'collection event driver must belong to the same tenant';
    end if;
  elsif tg_table_name = 'hazard_reports' then
    if not exists (select 1 from public.profiles where id = new.reported_by and tenant_id = new.tenant_id) then
      raise exception 'hazard reporter must belong to the same tenant';
    end if;
    if new.resolved_by is not null and not exists (select 1 from public.profiles where id = new.resolved_by and tenant_id = new.tenant_id) then
      raise exception 'hazard resolver must belong to the same tenant';
    end if;
  elsif tg_table_name = 'sos_events' then
    if not exists (select 1 from public.shifts where id = new.shift_id and tenant_id = new.tenant_id) then
      raise exception 'SOS shift must belong to the same tenant';
    end if;
    if not exists (select 1 from public.profiles where id = new.raised_by and tenant_id = new.tenant_id) then
      raise exception 'SOS reporter must belong to the same tenant';
    end if;
    if new.acknowledged_by is not null and not exists (select 1 from public.profiles where id = new.acknowledged_by and tenant_id = new.tenant_id) then
      raise exception 'SOS acknowledgement must belong to the same tenant';
    end if;
  elsif tg_table_name = 'device_telemetry' then
    if not exists (select 1 from public.devices where id = new.device_id and tenant_id = new.tenant_id) then
      raise exception 'telemetry device must belong to the same tenant';
    end if;
  elsif tg_table_name = 'alerts' then
    if new.bin_id is not null and not exists (select 1 from public.bins where id = new.bin_id and tenant_id = new.tenant_id) then
      raise exception 'alert bin must belong to the same tenant';
    end if;
    if new.device_id is not null and not exists (select 1 from public.devices where id = new.device_id and tenant_id = new.tenant_id) then
      raise exception 'alert device must belong to the same tenant';
    end if;
    if new.acknowledged_by is not null and not exists (select 1 from public.profiles where id = new.acknowledged_by and tenant_id = new.tenant_id) then
      raise exception 'alert acknowledgement must belong to the same tenant';
    end if;
    if new.resolved_by is not null and not exists (select 1 from public.profiles where id = new.resolved_by and tenant_id = new.tenant_id) then
      raise exception 'alert resolver must belong to the same tenant';
    end if;
  elsif tg_table_name = 'payroll_exports' then
    if not exists (select 1 from public.profiles where id = new.generated_by and tenant_id = new.tenant_id) then
      raise exception 'payroll export generator must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger user_roles_tenant_reference before insert or update on public.user_roles
for each row execute function app_private.enforce_tenant_references();
create trigger devices_tenant_reference before insert or update on public.devices
for each row execute function app_private.enforce_tenant_references();
create trigger shifts_tenant_reference before insert or update on public.shifts
for each row execute function app_private.enforce_tenant_references();
create trigger routes_tenant_reference before insert or update on public.routes
for each row execute function app_private.enforce_tenant_references();
create trigger route_stops_tenant_reference before insert or update on public.route_stops
for each row execute function app_private.enforce_tenant_references();
create trigger collection_events_tenant_reference before insert or update on public.collection_events
for each row execute function app_private.enforce_tenant_references();
create trigger hazard_reports_tenant_reference before insert or update on public.hazard_reports
for each row execute function app_private.enforce_tenant_references();
create trigger sos_events_tenant_reference before insert or update on public.sos_events
for each row execute function app_private.enforce_tenant_references();
create trigger device_telemetry_tenant_reference before insert or update on public.device_telemetry
for each row execute function app_private.enforce_tenant_references();
create trigger alerts_tenant_reference before insert or update on public.alerts
for each row execute function app_private.enforce_tenant_references();
create trigger payroll_exports_tenant_reference before insert or update on public.payroll_exports
for each row execute function app_private.enforce_tenant_references();

-- Security-definer helpers avoid direct profile/user_role reads in policies and prevent
-- recursive RLS evaluation. They intentionally use auth.uid(), never client-supplied IDs.
create or replace function app_private.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.tenant_id = target_tenant_id
      and profile.is_active = true
  );
$$;

create or replace function app_private.has_any_role(target_tenant_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles assigned_role
    join public.profiles profile on profile.id = assigned_role.user_id
    where assigned_role.tenant_id = target_tenant_id
      and assigned_role.user_id = auth.uid()
      and assigned_role.role = any (allowed_roles)
      and profile.is_active = true
  ) or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.tenant_id = target_tenant_id
      and profile.default_role = any (allowed_roles)
      and profile.is_active = true
  );
$$;

create or replace function app_private.is_route_assigned_to_current_driver(target_route_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.routes route
    join public.shifts shift on shift.id = route.shift_id
    where route.id = target_route_id
      and shift.driver_id = auth.uid()
      and shift.status in ('scheduled', 'active', 'paused')
  );
$$;

create or replace function app_private.is_route_stop_assigned_to_current_driver(target_route_stop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.route_stops route_stop
    join public.routes route on route.id = route_stop.route_id
    join public.shifts shift on shift.id = route.shift_id
    where route_stop.id = target_route_stop_id
      and shift.driver_id = auth.uid()
      and shift.status in ('scheduled', 'active', 'paused')
  );
$$;

create or replace function app_private.is_bin_assigned_to_current_driver(target_bin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.route_stops route_stop
    join public.routes route on route.id = route_stop.route_id
    join public.shifts shift on shift.id = route.shift_id
    where route_stop.bin_id = target_bin_id
      and shift.driver_id = auth.uid()
      and shift.status in ('scheduled', 'active', 'paused')
  );
$$;

create or replace function app_private.is_vehicle_assigned_to_current_driver(target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.shifts shift
    where shift.vehicle_id = target_vehicle_id
      and shift.driver_id = auth.uid()
      and shift.status in ('scheduled', 'active', 'paused')
  );
$$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  profile_record public.profiles;
  claims jsonb;
begin
  select * into profile_record from public.profiles where id = (event ->> 'user_id')::uuid;
  if profile_record.id is null or not profile_record.is_active then
    return event;
  end if;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    coalesce(claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
      'tenant_id', profile_record.tenant_id::text,
      'role', profile_record.default_role::text
    )
  );
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Enable this hook in Supabase Auth > Hooks (Custom Access Token), after creating
-- controlled tenant/profile provisioning. RLS below does not depend on the hook;
-- it provides a consistent verified role hint to server and UI code after activation.
grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated, public;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.vehicles enable row level security;
alter table public.bins enable row level security;
alter table public.devices enable row level security;
alter table public.shifts enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.collection_events enable row level security;
alter table public.hazard_reports enable row level security;
alter table public.sos_events enable row level security;
alter table public.device_telemetry enable row level security;
alter table public.alerts enable row level security;
alter table public.payroll_exports enable row level security;

create policy tenants_select_member on public.tenants for select to authenticated
using (app_private.is_tenant_member(id));
create policy tenants_update_admin on public.tenants for update to authenticated
using (app_private.has_any_role(id, array['admin']::public.app_role[]))
with check (app_private.has_any_role(id, array['admin']::public.app_role[]));

create policy profiles_select_tenant_member on public.profiles for select to authenticated
using (app_private.is_tenant_member(tenant_id));
create policy profiles_manage_admin on public.profiles for all to authenticated
using (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]));

create policy user_roles_select_admin on public.user_roles for select to authenticated
using (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]));
create policy user_roles_manage_admin on public.user_roles for all to authenticated
using (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]));

create policy vehicles_select_authorized on public.vehicles for select to authenticated
using (
  app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[])
  or app_private.is_vehicle_assigned_to_current_driver(id)
);
create policy vehicles_manage_dispatch on public.vehicles for all to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));

create policy bins_select_authorized on public.bins for select to authenticated
using (
  app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[])
  or app_private.is_bin_assigned_to_current_driver(id)
);
create policy bins_manage_dispatch on public.bins for all to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));

create policy devices_select_dispatch on public.devices for select to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));
create policy devices_manage_admin on public.devices for all to authenticated
using (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]));

create policy shifts_select_authorized on public.shifts for select to authenticated
using (
  app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[])
  or driver_id = auth.uid()
);
create policy shifts_manage_dispatch on public.shifts for all to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));

create policy routes_select_authorized on public.routes for select to authenticated
using (
  app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[])
  or app_private.is_route_assigned_to_current_driver(id)
);
create policy routes_manage_dispatch on public.routes for all to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));

create policy route_stops_select_authorized on public.route_stops for select to authenticated
using (
  app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[])
  or app_private.is_route_assigned_to_current_driver(route_id)
);
create policy route_stops_manage_dispatch on public.route_stops for all to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));

create policy collection_events_select_authorized on public.collection_events for select to authenticated
using (
  app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[])
  or driver_id = auth.uid()
);
create policy collection_events_insert_driver on public.collection_events for insert to authenticated
with check (
  driver_id = auth.uid()
  and app_private.is_tenant_member(tenant_id)
  and app_private.is_route_stop_assigned_to_current_driver(route_stop_id)
);

create policy hazard_reports_select_tenant_member on public.hazard_reports for select to authenticated
using (app_private.is_tenant_member(tenant_id));
create policy hazard_reports_insert_reporter on public.hazard_reports for insert to authenticated
with check (reported_by = auth.uid() and app_private.is_tenant_member(tenant_id));
create policy hazard_reports_manage_dispatch on public.hazard_reports for update to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));

create policy sos_events_select_authorized on public.sos_events for select to authenticated
using (
  app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[])
  or raised_by = auth.uid()
);
create policy sos_events_insert_driver on public.sos_events for insert to authenticated
with check (
  raised_by = auth.uid()
  and app_private.is_tenant_member(tenant_id)
  and exists (
    select 1 from public.shifts shift
    where shift.id = shift_id and shift.driver_id = auth.uid() and shift.status in ('active', 'paused')
  )
);
create policy sos_events_manage_dispatch on public.sos_events for update to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));

create policy device_telemetry_select_dispatch on public.device_telemetry for select to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));
-- There is deliberately no authenticated INSERT policy for telemetry. A trusted API or
-- MQTT ingestion worker validates device credentials and writes with server authority.

create policy alerts_select_tenant_member on public.alerts for select to authenticated
using (app_private.is_tenant_member(tenant_id));
create policy alerts_manage_dispatch on public.alerts for update to authenticated
using (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['dispatcher', 'admin']::public.app_role[]));

create policy payroll_exports_admin_only on public.payroll_exports for all to authenticated
using (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]))
with check (app_private.has_any_role(tenant_id, array['admin']::public.app_role[]));

-- Explicit grants retain the database as the enforcement point: grants permit the API
-- surface, and RLS policies above decide which rows and operations are actually valid.
grant select, insert, update, delete on public.tenants, public.profiles, public.user_roles,
  public.vehicles, public.bins, public.devices, public.shifts, public.routes,
  public.route_stops, public.collection_events, public.hazard_reports, public.sos_events,
  public.device_telemetry, public.alerts, public.payroll_exports to authenticated;
revoke all on all tables in schema public from anon;

comment on table public.device_telemetry is 'Append-only operational telemetry. Retention and partitioning should be configured before production volume.';
comment on function public.custom_access_token_hook(jsonb) is 'Supabase Custom Access Token Hook. Enable only after controlled profile provisioning is live.';
