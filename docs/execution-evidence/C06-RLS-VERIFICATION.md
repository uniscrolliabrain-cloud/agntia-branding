# C06 · Verificación de RLS con dos tenants

**Fecha:** 2026-11-17 · **Artefacto:** `packages/persistence/migrations/0001_init.sql` · **Verificador:** `scripts/verify-rls.mjs`

## Qué se ejecutó (y qué no)

La migración se aplicó por primera vez contra un **Postgres real embebido** (PGlite, Postgres 16 compilado a WASM), no contra Supabase gestionado. Se usó exactamente el SQL del repo, sin reescribir políticas ni añadir funciones auxiliares. Única desviación registrada: `create extension "pgcrypto"` se omitió porque PGlite no trae la extensión; `gen_random_uuid()` es nativo desde PostgreSQL 13 y la migración no usa nada más de pgcrypto.

```text
node scripts/verify-rls.mjs
migración aplicada (sin pgcrypto: gen_random_uuid es nativo desde PG13)
RESUMEN 15/15 PASS
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
| Owner no-superusuario sólo ve su tenant | `force row level security` | PASS · `res_a` |
| Owner no-superusuario sin claims no ve nada | `force row level security` | PASS · 0 filas |

## Hallazgo corregido: el owner ya no escapa del RLS

La primera ejecución mostró `relforcerowsecurity = false` y el owner viendo **2 recursos de 2 tenants**. Se corrigió en la migración: las 11 tablas llevan ahora `enable row level security` **y** `force row level security`, verificado en `pg_class` (`approvals=true audit_log=true memberships=true outbox=true resources=true`).

Las dos aserciones nuevas lo demuestran sobre un owner no-superusuario: ve solo `res_a` con claims del tenant A y **0 filas** sin claims.

Lo que el motor no permite cerrar: **un superusuario bypasea RLS por diseño** (sigue viendo 2 filas). Por eso `service_role` o el rol `postgres` de Supabase tampoco quedan contenidos: la regla operativa es que la aplicación conecte como `branding_api`/`branding_worker`, nunca como superusuario ni `service_role`.

Consecuencia para operación: un backfill bajo `FORCE RLS` debe fijar `request.jwt.claims` con `SET LOCAL` dentro de su transacción, o usar un rol de mantenimiento con `BYPASSRLS` explícito, auditado y de vida corta. Un `psql` como owner ya no ve todas las filas por defecto, que es justo lo que se quería.

## Riesgo de despliegue: pooling

`current_tenant()` lee el GUC `request.jwt.claims`. En PostgREST/Supabase se fija por transacción, pero **con un pooler (Supavisor/PgBouncer en modo sesión) un `SET` de sesión puede sobrevivir y filtrar el tenant de una petición a la siguiente**. Regla: fijar los claims con `SET LOCAL` dentro de la transacción y nunca con `SET` de sesión, más un test de concurrencia con claims alternos antes de producción.

## Lo que sigue sin verificar

- Supabase gestionado (JWT real emitido por el proyecto, `authenticated`/`anon` de plataforma, PostgREST y pooler reales).
- Migración aplicada con `supabase db push` / CLI y su historial de migraciones.
- Comportamiento bajo concurrencia y con `statement_timeout` reales.
- Backups, PITR y restore (C41).

Este documento acredita **RLS verificado en Postgres**, no **RLS verificado en producción**.
