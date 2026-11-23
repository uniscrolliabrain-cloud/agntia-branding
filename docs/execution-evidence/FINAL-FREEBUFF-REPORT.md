# Freebuff · Informe de ejecución de la fábrica — agntia-branding

**Fecha:** 2026-11-15 · **Base:** `7734d6d` (`main`) · **Rama de trabajo:** `freebuff/0cf2b25a7e0a26aedf48cb84`
**Alcance autorizado por el fundador:** implementar el código de las 42 fases en este repositorio (cambio registrado en `AGENTS.md`).

> Leer el estado tal como está: hay código real con tests en verde en memoria, **no** producto desplegado. Ningún proveedor externo, base de datos ni UI ha sido provisionado o probado contra runtime real.

---

## 1. Baseline y comandos ejecutados

| Comprobación | Comando | Resultado real |
|---|---|---|
| SHA de partida | `git rev-parse HEAD` | `7734d6d` (antes de la implementación) |
| Inventario previo | `git ls-files` | 174 archivos, **0 de código** |
| Instalación | `npm ci` / `npm install` | OK (55 paquetes, sin scripts no aprobados) |
| Typecheck | `npm run typecheck` | **0 errores** |
| Tests | `npm test` | **122 tests · 11 archivos · 100 % en verde** |
| Migración SQL | no ejecutada | **NOT_VERIFIED** (no hay Postgres) |
| Workflow CI | no ejecutado en GitHub | **NOT_VERIFIED** (definido en `.github/workflows/ci.yml`) |

## 2. Qué se ha construido

Monorepo npm workspaces (TypeScript estricto, Hono, Zod, Vitest) con 33 archivos fuente:

| Paquete | Superficie |
|---|---|
| `packages/contracts` | Envelope estricto, IDs opacos, dinero decimal (bigint), `EvidenceRef`, `ApprovalBinding`, `OperationResult`, `CapabilityReport`, errores normalizados, hashing canónico |
| `packages/domain` | `AuthorityMap`, FSM de dominio y operación, aprobaciones ligadas a hash, brief, research, naming, clearance, voz, conceptos, rights ledger, fuentes, documento vectorial con CAS y render fingerprint, SVG allowlist, Penpot binding, logo, contraste WCAG calculado, tokens con ciclos, Style Dictionary determinista, plantillas, layouts, composición reversible, QA de texto/visual, brandbook, preflight, entrega, aprendizaje con replay, reportes, sesión Anam, contrato de rutas, bridge de eventos, handoff, presupuesto, privacidad, release y aceptación |
| `packages/identity` | Verificación JWT Supabase (RS256/ES256, JWKS fijo, issuer/audience/tiempos, `alg none` rechazado), `user_metadata` ignorado, membership provisionada, ACL recurso/campo, `TwinBinding` y `DelegationMandate` |
| `packages/persistence` | `ResourceStore` tenant-scoped con CAS, audit append-only, outbox/inbox, idempotencia durable, migración `0001_init.sql` con RLS, FKs compuestas y roles `branding_api`/`branding_worker` (**sin ejecutar**) |
| `packages/adapters` | Discovery con estados honestos, URLs firmadas por tenant, puertos Penpot y Anam con `not_configured` (sin endpoints inventados) |
| `apps/api` | Hono con PEP, envelope, idempotencia, errores 400/401/403/404/409/422, health, me, resources, proposals, preview, intents, jobs, capabilities, imports, reports, advisor-sessions |
| `packages/sdk` | Cliente servidor tipado con allowlist de rutas y error mapping |

## 3. Matriz de 42 campañas

Leyenda: **PASS_LOCAL** = código + test automatizado en verde, en memoria. **PARTIAL_LOCAL** = código presente pero con dependencia no provisionada o sin test directo. **NOT_VERIFIED** = requiere runtime real. Ningún `PASS_LOCAL` acredita un gate de producto con proveedor real.

| Fase | Evidencia | Estado |
|---|---|---|
| C01 Baseline, fuentes y alcance | `C01-BASELINE-AUDIT.md`, FSM, timeout/incertidumbre | PARTIAL_LOCAL |
| C02 Autoridad por dominio | `authority.ts` + tests de ambigüedad/fail-closed | PASS_LOCAL |
| C03 Supabase JWT y principal | `jwt.ts`, `principal.ts` + 8 tests adversariales de token | PASS_LOCAL |
| C04 Twins y nomenclatura | `TwinBinding`, `DelegationMandate` + tests de exceso/expiry | PASS_LOCAL |
| C05 DTOs y errores | envelope estricto, dinero decimal, hash canónico | PASS_LOCAL |
| C06 Persistencia y RLS | `memory.ts` + tests; **RLS verificado 15/15 en Postgres embebido, con FORCE RLS** (`C06-RLS-VERIFICATION.md`); Supabase gestionado y pooling sin probar | PARTIAL_LOCAL |
| C07 Mandatos y aprobaciones | `approval.ts` + 3 tests de invalidación | PASS_LOCAL |
| C08 Secretos y discovery | discovery, endpoints ligados, URLs firmadas; proveedor real ausente | PARTIAL_LOCAL |
| C09 Brief | `strategy.ts` + pendientes explícitos | PASS_LOCAL |
| C10 Investigación | rechazo de directivas embebidas, licencia de fuente | PASS_LOCAL |
| C11 Naming | claims legales prohibidos, `not_checked` | PASS_LOCAL |
| C12 Clearance | cobertura incompleta → `insufficient_scope` | PASS_LOCAL |
| C13 Identidad verbal | claims sin fuente/permiso → revisión | PASS_LOCAL |
| C14 Direcciones visuales | moodboard no licenciado bloqueado | PASS_LOCAL |
| C15 Ledger de derechos | revocación y purpose, activo sin registro | PASS_LOCAL |
| C16 Tipografía | embedding/redistribución, sin fallback silencioso | PASS_LOCAL |
| C17 Documento vectorial | CAS, nodos bloqueados, render determinista | PASS_LOCAL |
| C18 Penpot | binding tenant/fichero + puerto; `not_configured` | PARTIAL_LOCAL |
| C19 Canvas Fabric/SVG | allowlist y rechazo de script/handlers/data URLs | PASS_LOCAL |
| C20 Logotipo | edición tras aprobación invalida paquete | PASS_LOCAL |
| C21 Paleta y accesibilidad | contraste WCAG calculado | PASS_LOCAL |
| C22 Design tokens | ciclos, tipos, dependientes | PASS_LOCAL |
| C23 Style Dictionary | build reproducible, transforms allowlisted | PASS_LOCAL |
| C24 Plantillas | slots y nodos protegidos | PASS_LOCAL |
| C25 Layouts responsive | overflow con medidas reales, pendiente sin renderer | PASS_LOCAL |
| C26 Composición | patch inverso y CAS | PASS_LOCAL |
| C27 QA de texto | número alterado bloquea | PASS_LOCAL |
| C28 QA visual | score alto no compensa fallo; decisión humana | PASS_LOCAL |
| C29 Brandbook | regla obsoleta, activos aprobados | PASS_LOCAL |
| C30 Export y preflight | blockers por fuente/derechos/QA/SVG, manifest con checksum | PASS_LOCAL |
| C31 Entrega | ACL receptor, publicación separada, receipt | PASS_LOCAL |
| C32 Aprendizaje | replay + aprobación humana, sin autoactivación | PASS_LOCAL |
| C33 Reportes | definición y fuente obligatorias, p95 medido | PASS_LOCAL |
| C34 Portal y Anam | scope de sesión; Anam `not_configured`; sin UI | PARTIAL_LOCAL |
| C35 SDK/Hono/tools | SDK + allowlist; sin servidor HTTP real levantado | PARTIAL_LOCAL |
| C36 Bridge de eventos | solo hechos confirmados, tipo host | PASS_LOCAL |
| C37 Handoff | ACK obligatorio, transiciones | PASS_LOCAL |
| C38 Coste y observabilidad | presupuesto sin doble gasto, percentiles; coste proveedor no medido | PARTIAL_LOCAL |
| C39 Privacidad y adversarial | centinelas de secretos, legal hold, restore | PASS_LOCAL |
| C40 Vertical E2E | dos tenants, receipt, outbox, revocación, incertidumbre (en memoria) | PASS_LOCAL |
| C41 Operaciones y release | gate de release, flags; backup/restore **no probado** | PARTIAL_LOCAL |
| C42 Aceptación | matriz degrada PASS sin evidencia; repo no completo | PASS_LOCAL |

**34 PASS_LOCAL · 8 PARTIAL_LOCAL · 0 NOT_VERIFIED como fase completa.**

### Gates (84 escenarios diseñados)

**Ejecutados formalmente como gates de campaña: 0/84.** Los tests cubren invariantes de negocio y adversariales (cross-tenant, `alg none`, `user_metadata`, replay, aprobación invalidada, revocación, SVG ejecutable, alias cíclico, overflow, publicación sin aprobación), pero no sustituyen los 84 escenarios con proveedor, DB y UI reales. Cualquier afirmación de "84 gates superados" sería falsa.

## 4. Lo que NO está verificado

- **Supabase real**: no hay proyecto, issuer/JWKS ni tokens emitidos. La verificación se prueba con claves y JWKS sintéticos.
- **Postgres/Supabase gestionado**: la migración se aplicó y las políticas RLS se probaron con dos tenants sobre PGlite (Postgres real embebido): 15/15 PASS, incluidos owner no-superusuario contenido por `FORCE RLS` y append-only. Sigue sin probarse un proyecto Supabase real, ni PostgREST, ni el pooler, ni la concurrencia entre claims. Límite del motor: un superusuario (o `service_role`) bypasea RLS; la API debe conectar como `branding_api`.
- **Penpot / Anam**: puertos y estados `not_configured`; sin cuenta, endpoint ni credencial.
- **UI/portal y editor vectorial**: no existen. No hay render PDF/PNG, OCR ni medición tipográfica real (C25 depende de medidas inyectadas).
- **Coste real**: presupuesto determinista, sin tarifas ni consumo de proveedor.
- **Servidor HTTP**: `apps/api/src/server.ts` exige `SUPABASE_ISSUER/AUDIENCE/JWKS_URL` y no se ha arrancado.
- **CI**: workflow definido, no ejecutado en GitHub.

## 5. Preparación Doppler (nombres, sin valores)

| Variable | Uso | Estado |
|---|---|---|
| `SUPABASE_ISSUER` | issuer firmado esperado | requerida por el servidor |
| `SUPABASE_AUDIENCE` | audiencia del proyecto | requerida |
| `SUPABASE_JWKS_URL` | endpoint JWKS fijo de servidor | requerida |
| `BRANDING_MEMBERSHIPS_JSON` | memberships de desarrollo; en producción, DB | solo dev |
| `PORT` | puerto de escucha | opcional |
| `DATABASE_URL` | Postgres/RLS | pendiente de provisión |
| `STORAGE_SIGNING_SECRET` | URLs firmadas | pendiente |
| `PENPOT_BASE_URL` / ref de token | adaptador opcional | no configurado |
| `ANAM_API_KEY` (ref) | sesión AV | no configurado |

Sin secretos en el repo: el CI bloquea `.env*` y patrones de claves.

## 6. Integración con el padre (propuesta, sin cambios)

1. Validar `TwinBinding`/mandato contra los contratos reales de `agente` en el SHA vigente antes de conectar.
2. Mapear `branding.*` a `SystemEvent` nativo (`schemaVersion:"1.0"`, `owner`, `source`) mediante el bridge ya implementado; no inventar enums.
3. Workers con identidad de servicio y delegación verificable; nunca un JWT humano reutilizado en cola.
4. Entregar `docs/execution-evidence/` y este informe a Codex para auditoría del SHA; el merge a `main` lo decide el fundador.

## 7. Siguiente paso recomendado

1. Provisionar Supabase + Postgres de staging y ejecutar `0001_init.sql` con pruebas RLS de dos tenants (C06 real).
2. Levantar el servidor con un proyecto Supabase de pruebas y ejecutar el flujo E2E por HTTP, no solo `app.request`.
3. Decidir UI mínima (portal + visor de propuestas) o declararla fuera de alcance.
4. Solo entonces reevaluar C18/C34/C35/C41 y actualizar la matriz.
