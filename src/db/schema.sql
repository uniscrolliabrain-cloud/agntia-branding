-- Agntia Branding — esquema base con aislamiento por tenant.
--
-- Reglas que este archivo hace cumplir:
--   * toda tabla de dominio lleva tenant_id y habilita RLS (y FORCE, para que el
--     propietario de la tabla tampoco la evada);
--   * las referencias entre recursos usan FK compuesta (tenant_id, id), de modo
--     que es imposible enlazar un documento con un activo de otro tenant;
--   * la política lee el tenant de una variable de sesión fijada por el servidor
--     tras verificar el JWT, nunca de un valor enviado por el cliente;
--   * el rol de la API no tiene BYPASSRLS. service_role no es una excusa.
--
-- Este esquema no se ha aplicado en ningún entorno real desde este repositorio.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_api') then
    create role app_api nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_worker') then
    create role app_worker nologin;
  end if;
end
$$;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'reviewer', 'collaborator', 'viewer')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists work_orders (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  objective text not null,
  deliverable text not null,
  acceptance text not null,
  state text not null default 'open' check (state in ('open', 'in_progress', 'review', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

-- One responsible party per effect. Overlap between specialist repos is allowed;
-- double execution is not.
create table if not exists authority_map (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  work_order_id uuid not null,
  effect text not null,
  owner_repo text not null,
  backup_repo text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id),
  unique (tenant_id, work_order_id, effect),
  foreign key (tenant_id, work_order_id) references work_orders (tenant_id, id) on delete cascade
);

create table if not exists brand_briefs (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  version integer not null default 0,
  state text not null check (state in ('brief_draft', 'researching', 'concept_proposed', 'in_design', 'needs_rights_review', 'in_review', 'approved', 'released', 'superseded', 'revoked')),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id, version)
);

create table if not exists design_documents (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  version integer not null default 0,
  state text not null default 'in_design',
  document jsonb not null,
  document_hash text not null,
  font_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists document_versions (
  tenant_id uuid not null,
  document_id uuid not null,
  version integer not null,
  document_hash text not null,
  render_hash text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, document_id, version),
  foreign key (tenant_id, document_id) references design_documents (tenant_id, id) on delete cascade
);

create table if not exists asset_rights (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  asset_hash text not null,
  source text not null check (source in ('owned', 'licensed', 'commissioned', 'open_license', 'generated')),
  license_ref text not null,
  release_ref text,
  purposes text[] not null,
  territory text[] not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  primary key (tenant_id, id),
  unique (tenant_id, asset_hash)
);

create table if not exists font_licenses (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  family text not null,
  foundry text not null,
  license_ref text not null,
  license_verified boolean not null default false,
  embedding_allowed boolean not null default false,
  subsetting_allowed boolean not null default false,
  redistribution_allowed boolean not null default false,
  verified_at timestamptz,
  primary key (tenant_id, id),
  unique (tenant_id, family)
);

create table if not exists token_sets (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  version integer not null default 0,
  theme text not null check (theme in ('light', 'dark', 'brand')),
  tokens jsonb not null,
  primary key (tenant_id, id, version)
);

-- An approval is bound to the exact material it approved.
create table if not exists approvals (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  resource_type text not null,
  resource_id uuid not null,
  reviewer_id uuid not null,
  reviewer_role text not null check (reviewer_role in ('owner', 'reviewer')),
  payload_hash text not null,
  resource_version integer not null,
  rights_hash text not null,
  policy_hash text not null,
  recipient text,
  channel text not null check (channel in ('portal', 'email_link', 'download', 'none')),
  cost_ceiling numeric(20, 6) not null,
  currency char(3) not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_version integer not null default 0,
  primary key (tenant_id, id)
);

create table if not exists intents (
  tenant_id uuid not null references tenants(id) on delete cascade,
  capability text not null,
  idempotency_key text not null,
  payload_hash text not null,
  status text not null check (status in ('in_progress', 'succeeded', 'failed', 'outcome_unknown')),
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, capability, idempotency_key)
);

create table if not exists outbox (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  event_type text not null,
  domain_event_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  attempts integer not null default 0,
  primary key (tenant_id, id),
  unique (tenant_id, domain_event_id)
);

create table if not exists inbox (
  tenant_id uuid not null references tenants(id) on delete cascade,
  domain_event_id text not null,
  received_at timestamptz not null default now(),
  committed_at timestamptz,
  primary key (tenant_id, domain_event_id)
);

create table if not exists audit_events (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  actor_id uuid not null,
  capability text not null,
  outcome text not null check (outcome in ('allowed', 'denied', 'blocked')),
  reason text,
  correlation_id text not null,
  at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists jobs (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  capability text not null,
  status text not null check (status in ('queued', 'running', 'confirmed', 'failed_definitive', 'outcome_unknown', 'reconciliation_required')),
  attempt integer not null default 0,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists budgets (
  tenant_id uuid not null references tenants(id) on delete cascade,
  currency char(3) not null,
  ceiling numeric(20, 6) not null,
  reserved numeric(20, 6) not null default 0,
  consumed numeric(20, 6) not null default 0,
  primary key (tenant_id, currency),
  check (reserved >= 0 and consumed >= 0 and reserved + consumed <= ceiling)
);

create table if not exists provider_connections (
  tenant_id uuid not null references tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  provider text not null,
  edition text not null,
  endpoint_ref text not null,
  secret_ref text not null,
  binding jsonb not null default '{}'::jsonb,
  capability_status text not null default 'not_configured'
    check (capability_status in ('documented', 'verified_runtime', 'unknown', 'unsupported', 'forbidden', 'not_configured')),
  primary key (tenant_id, id),
  unique (tenant_id, provider, endpoint_ref)
);

-- ---------------------------------------------------------------------------
-- RLS: deny by default, tenant predicate from the server-set session variable.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'memberships', 'work_orders', 'authority_map', 'brand_briefs', 'design_documents',
    'document_versions', 'asset_rights', 'font_licenses', 'token_sets', 'approvals',
    'intents', 'outbox', 'inbox', 'audit_events', 'jobs', 'budgets', 'provider_connections'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) with check (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
    execute format('grant select, insert, update, delete on %I to app_api', t);
    execute format('grant select, insert, update on %I to app_worker', t);
  end loop;
end
$$;

alter table tenants enable row level security;
alter table tenants force row level security;
create policy tenant_self on tenants
  using (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.tenant_id', true), '')::uuid);
grant select on tenants to app_api;

-- The application never runs as a superuser or as the table owner in production.
revoke all on all tables in schema public from public;
