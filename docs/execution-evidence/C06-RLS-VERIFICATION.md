# C06 · Verificación de RLS con dos tenants

**Fecha:** 2026-11-17 · **Artefacto:** `packages/persistence/migrations/0001_init.sql` · **Verificador:** `scripts/verify-rls.mjs`

## Qué se ejecutó (y qué no)

La migración se aplicó por primera vez contra un **Postgres real embebido** (PGlite, Postgres 16 compilado a WASM), no contra Supabase gestionado. Se usó exactamente el SQL del repo, sin reescribir políticas ni añadir funciones auxiliares. Única desviación registrada: `create extension "pgcrypto"` se omitió porque PGlite no trae la extensión; `gen_random_uuid()` es nativo desde PostgreSQL 13 y la migración no usa nada más de pgcrypto.

```text
node scripts/verify-rls.mjs
migración aplicada (sin pgcrypto: gen_random_uuid es nativo desde PG13)
RESUMEN 13/13 PASS
```

## Resultados

| Aserción | Mecanismo | Resultado |
|---|---|---|
| A sólo ve recursos de A | `using (tenant_id = current_tenant())` con `request.jwt.claims` | PASS · `res_a` |
| B sólo ve recursos de B | idem | PASS · `res_b` |
| Sin claims no ve nada | `current_setting(..., true)` vacío → `null` | PASS · 0 filas |
| `app_metadata.tenant_id` también autoriza | fallback documentado en `current_tenant()` | PASS |
| A no puede insertar para B | `with check` | PASS · `new row violates row-level security policy` |
| A no puede modificar la fila de B | `using` oculta la fila | PASS · 0 filas afectadas, payload de B intacto |
| UPDATE de A afecta sólo a A | aislamiento por fila | PASS |
| `audit_log` no admite UPDATE | privilegios + trigger append-only | PASS · `permission denied` |
| `audit_log` no admite DELETE | idem | PASS · `permission denied` |
| `branding_worker` no actualiza `resources` | grants por rol | PASS · `permission denied` |
| `branding_worker` no escribe `revisions` | grants por rol | PASS · `permission denied` |
| Revisión cross-tenant rechazada | FK compuesta + RLS | PASS |
| `inbox` ilegible por `branding_api` | grants por rol | PASS |

## Hallazgo abierto (no corregido en este commit)

`relforcerowsecurity = false` en todas las tablas y el owner/superusuario ve **2 recursos de 2 tenants**. Consecuencias:

1. Si la API se conecta como **owner** de las tablas o como `service_role`, **el RLS no se aplica** y el aislamiento depende solo del filtrado de la aplicación.
2. Por eso el rol de conexión debe ser `branding_api` (o `branding_worker`), nunca el owner del esquema, y debe verificarse en el arranque de la aplicación.
3. Endurecerlo requiere `alter table ... force row level security`, que también sometería al owner; hay que decidir antes cómo se hacen backfills (con claims explícitos o rol de mantenimiento auditado).

## Riesgo de despliegue: pooling

`current_tenant()` lee el GUC `request.jwt.claims`. En PostgREST/Supabase se fija por transacción, pero **con un pooler (Supavisor/PgBouncer en modo sesión) un `SET` de sesión puede sobrevivir y filtrar el tenant de una petición a la siguiente**. Regla: fijar los claims con `SET LOCAL` dentro de la transacción y nunca con `SET` de sesión, más un test de concurrencia con claims alternos antes de producción.

## Lo que sigue sin verificar

- Supabase gestionado (JWT real emitido por el proyecto, `authenticated`/`anon` de plataforma, PostgREST y pooler reales).
- Migración aplicada con `supabase db push` / CLI y su historial de migraciones.
- Comportamiento bajo concurrencia y con `statement_timeout` reales.
- Backups, PITR y restore (C41).

Este documento acredita **RLS verificado en Postgres**, no **RLS verificado en producción**.
