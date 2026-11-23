-- agntia-branding · 0001_init
-- NOT VERIFIED against a live Postgres: no database is provisioned in this
-- implementation. The schema is the executable contract for migrations; RLS
-- behaviour must be proven with a real instance before claiming it.
--
-- Invariants: tenant isolation by RLS on every table, roles for api/worker,
-- composite FKs, no secrets or provider tokens persisted as domain data.

create extension if not exists "pgcrypto";

create schema if not exists branding;

-- ---------------------------------------------------------------------------
-- Tenants y membership provisionada (nunca user_metadata)
-- ---------------------------------------------------------------------------
create table if not exists branding.tenants (
  tenant_id text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists branding.memberships (
  tenant_id text not null references branding.tenants (tenant_id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner','brand_reviewer','legal_reviewer','collaborator','viewer','service')),
  status text not null check (status in ('active','invited','suspended','revoked')),
  scopes text[] not null default '{}',
  provisioned_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Recursos, versiones y auditoría
-- ---------------------------------------------------------------------------
create table if not exists branding.resources (
  tenant_id text not null references branding.tenants (tenant_id) on delete cascade,
  resource_id text not null,
  kind text not null,
  version integer not null default 0 check (version >= 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null,
  primary key (tenant_id, resource_id)
);

create table if not exists branding.resource_revisions (
  tenant_id text not null,
  resource_id text not null,
  version integer not null,
  payload jsonb not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  primary key (tenant_id, resource_id, version),
  foreign key (tenant_id, resource_id) references branding.resources (tenant_id, resource_id) on delete cascade
);

create table if not exists branding.audit_log (
  entry_id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  actor_id text not null,
  action text not null,
  resource_id text,
  payload_hash text not null,
  correlation_id text not null,
  at timestamptz not null default now()
);

-- Append-only: no update/delete grants for API or worker roles.
create or replace function branding.reject_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only table %', tg_table_name;
end;
$$;

drop trigger if exists audit_log_append_only on branding.audit_log;
create trigger audit_log_append_only
  before update or delete on branding.audit_log
  for each row execute function branding.reject_mutation();

-- ---------------------------------------------------------------------------
-- Aprobaciones, intents e idempotencia
-- ---------------------------------------------------------------------------
create table if not exists branding.approvals (
  tenant_id text not null,
  approval_id text not null,
  resource_id text not null,
  principal_id text not null,
  reviewer_role text not null,
  proof_ref text not null,
  payload_hash text not null,
  resource_version integer not null,
  rights_hash text not null,
  policy_hash text not null,
  scope text not null,
  recipient text not null,
  channel text not null,
  cost_amount numeric(20, 6) not null,
  cost_currency char(3) not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_version integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (tenant_id, approval_id),
  foreign key (tenant_id, resource_id) references branding.resources (tenant_id, resource_id) on delete cascade
);

create table if not exists branding.intents (
  tenant_id text not null,
  operation_key text not null,
  capability text not null,
  payload_hash text not null,
  status text not null check (status in ('proposed','needs_review','approved','queued','running','accepted','confirmed','failed_definitive','outcome_unknown','reconciliation_required','cancelled')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, operation_key)
);

create table if not exists branding.operation_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  operation_key text not null,
  attempt integer not null,
  outcome text not null,
  remote_ref text,
  payload_hash text not null,
  at timestamptz not null default now(),
  foreign key (tenant_id, operation_key) references branding.intents (tenant_id, operation_key) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Outbox / inbox
-- ---------------------------------------------------------------------------
create table if not exists branding.outbox (
  event_id text not null,
  tenant_id text not null,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts integer not null default 0,
  primary key (tenant_id, event_id)
);

create index if not exists outbox_pending_idx on branding.outbox (tenant_id, created_at) where delivered_at is null;

create table if not exists branding.inbox (
  consumer_id text not null,
  event_id text not null,
  tenant_id text not null,
  received_at timestamptz not null default now(),
  primary key (consumer_id, event_id)
);

-- ---------------------------------------------------------------------------
-- Derechos de activos, fuentes y tokens
-- ---------------------------------------------------------------------------
create table if not exists branding.asset_rights (
  tenant_id text not null,
  rights_id text not null,
  asset_hash text not null,
  source text not null,
  license_ref text,
  release_ref text,
  purposes text[] not null,
  territory text[] not null default '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  attribution text,
  primary key (tenant_id, rights_id),
  unique (tenant_id, asset_hash)
);

create table if not exists branding.font_licenses (
  tenant_id text not null,
  font_id text not null,
  family text not null,
  font_hash text not null,
  family_license text not null,
  embedding_print boolean not null default false,
  embedding_web boolean not null default false,
  embedding_editable boolean not null default false,
  redistribution_allowed boolean not null default false,
  fallback_policy text not null check (fallback_policy in ('block','ask_review','substitute_declared')),
  license_ref text,
  primary key (tenant_id, font_id)
);

-- ---------------------------------------------------------------------------
-- RLS: cada tabla aislada por tenant firmado
-- ---------------------------------------------------------------------------
create or replace function branding.current_tenant() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id',
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'tenant_id'
  );
$$;

-- enable + force: el owner del esquema tampoco escapa del aislamiento. Un
-- backfill debe fijar request.jwt.claims con SET LOCAL o usar un rol de
-- mantenimiento con BYPASSRLS explícito y auditado. Un superusuario sigue
-- bypasando RLS por diseño del motor: la app nunca debe conectar como tal.
alter table branding.resources enable row level security;
alter table branding.resources force row level security;
alter table branding.resource_revisions enable row level security;
alter table branding.resource_revisions force row level security;
alter table branding.audit_log enable row level security;
alter table branding.audit_log force row level security;
alter table branding.approvals enable row level security;
alter table branding.approvals force row level security;
alter table branding.intents enable row level security;
alter table branding.intents force row level security;
alter table branding.operation_attempts enable row level security;
alter table branding.operation_attempts force row level security;
alter table branding.outbox enable row level security;
alter table branding.outbox force row level security;
alter table branding.inbox enable row level security;
alter table branding.inbox force row level security;
alter table branding.asset_rights enable row level security;
alter table branding.asset_rights force row level security;
alter table branding.font_licenses enable row level security;
alter table branding.font_licenses force row level security;
alter table branding.memberships enable row level security;
alter table branding.memberships force row level security;

create policy resources_tenant_isolation on branding.resources
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy revisions_tenant_isolation on branding.resource_revisions
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy audit_tenant_isolation on branding.audit_log
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy approvals_tenant_isolation on branding.approvals
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy intents_tenant_isolation on branding.intents
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy attempts_tenant_isolation on branding.operation_attempts
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy outbox_tenant_isolation on branding.outbox
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy inbox_tenant_isolation on branding.inbox
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy rights_tenant_isolation on branding.asset_rights
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy fonts_tenant_isolation on branding.font_licenses
  using (tenant_id = branding.current_tenant())
  with check (tenant_id = branding.current_tenant());

create policy memberships_self_read on branding.memberships
  using (tenant_id = branding.current_tenant());

-- ---------------------------------------------------------------------------
-- Roles reales (service_role no es una garantía de RLS)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'branding_api') then
    create role branding_api nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'branding_worker') then
    create role branding_worker nologin;
  end if;
end;
$$;

grant usage on schema branding to branding_api, branding_worker;
grant select, insert, update on branding.resources, branding.approvals, branding.intents to branding_api;
grant select, insert on branding.audit_log, branding.resource_revisions to branding_api;
grant select, insert, update on branding.outbox to branding_worker;
grant select, insert on branding.inbox to branding_worker;
grant select on branding.asset_rights, branding.font_licenses, branding.memberships to branding_api, branding_worker;

-- branding_worker may never UPDATE or DELETE audit/revisions.
revoke update, delete on branding.audit_log, branding.resource_revisions from branding_api, branding_worker;
