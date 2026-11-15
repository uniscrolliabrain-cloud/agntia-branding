-- Fixtures sintéticos de dos tenants (A y B) y un operador (P).
--
-- Nada aquí procede de un cliente real. Los UUID son fijos para que los tests y
-- los informes de evidencia sean reproducibles. Se ejecuta después de schema.sql.

insert into tenants (id, slug) values
  ('11111111-1111-4111-8111-111111111111', 'tenant-a'),
  ('22222222-2222-4222-8222-222222222222', 'tenant-b'),
  ('99999999-9999-4999-8999-999999999999', 'operator-p')
on conflict (id) do nothing;

-- Owner de A: acceso amplio dentro de su tenant.
insert into memberships (id, tenant_id, user_id, role, status, scopes) values
  ('a1000000-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'owner', 'active',
   '[{"resourceType":"tenant","resourceId":null,"fields":[]}]'::jsonb),
  -- Colaborador de A: restringido a un work order concreto.
  ('a1000000-0000-4000-8000-000000000002',
   '11111111-1111-4111-8111-111111111111',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'collaborator', 'active',
   '[{"resourceType":"work_order","resourceId":"wo-a-0001","fields":["brief","concept"]}]'::jsonb),
  -- Owner de B: mismo rol, tenant distinto, cero acceso a A.
  ('b2000000-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'owner', 'active',
   '[{"resourceType":"tenant","resourceId":null,"fields":[]}]'::jsonb),
  -- Operador P: debe actuar sobre A sólo por delegación explícita.
  ('c3000000-0000-4000-8000-000000000001',
   '99999999-9999-4999-8999-999999999999',
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'owner', 'active',
   '[{"resourceType":"tenant","resourceId":null,"fields":[]}]'::jsonb)
on conflict (tenant_id, user_id) do nothing;

insert into budgets (tenant_id, currency, ceiling, reserved, consumed) values
  ('11111111-1111-4111-8111-111111111111', 'EUR', 30.000000, 0, 0),
  ('22222222-2222-4222-8222-222222222222', 'EUR', 30.000000, 0, 0),
  ('99999999-9999-4999-8999-999999999999', 'EUR', 30.000000, 0, 0)
on conflict (tenant_id, currency) do nothing;

insert into work_orders (tenant_id, id, objective, deliverable, acceptance, state) values
  ('11111111-1111-4111-8111-111111111111',
   'aa000000-0000-4000-8000-000000000001',
   'Identidad de marca sintética para el tenant A',
   'brief + conceptos + tokens + brandbook',
   'revisión humana del owner con derechos trazables',
   'open')
on conflict (tenant_id, id) do nothing;

insert into authority_map (tenant_id, work_order_id, effect, owner_repo, backup_repo) values
  ('11111111-1111-4111-8111-111111111111',
   'aa000000-0000-4000-8000-000000000001',
   'brand.export.preview',
   'agntia-branding',
   null)
on conflict (tenant_id, work_order_id, effect) do nothing;
