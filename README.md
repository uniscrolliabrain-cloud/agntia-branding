# agntia-branding

Branding, diseño y sistemas de marca: diseño de empresa SaaS especialista con middleware hacia AgntiaPro/`agente`. Entrega documental de la familia Agntia · 2026-11-13.

**IMPLEMENTACIÓN EN CURSO (actualizado 2026-11-23), NO producto terminado.** Existe un monorepo TypeScript (contratos Zod, dominio determinista, identidad JWT, persistencia, adaptadores, API Hono, SDK) con **131 tests en verde**, typecheck limpio y paquetes ESM instalables desde otro repositorio. La vertical P0 (`brief → research → naming → clearance → voice → tokens → design → qa → review → export → delivery → brandbook`) se ejecuta por HTTP con gates deterministas. Siguen sin verificar: Supabase real, Postgres/RLS en instancia, Penpot, Anam, editor vectorial y portal (UI). Las 42 campañas siguen abiertas como gates de producto: cobertura local en [docs/execution-evidence/FINAL-FREEBUFF-REPORT.md](docs/execution-evidence/FINAL-FREEBUFF-REPORT.md). Aspiración de calidad inspirada en referentes mundiales; no afirmación de paridad, certificación o cumplimiento universal.

Entregar identidad y materiales de marca editables, coherentes, accesibles y trazables con revisión humana y derechos de uso demostrables.

Se presta servicio a empresas del padre y a clientes externos mediante portal propio. Agentes canónicos en `/agente`, twins vinculados aquí; todos los modos con JWT Supabase, membresía/ACL verificados y aislamiento de datos/jobs/archivos/búsqueda/Realtime/exportaciones. Se permite duplicación de funciones con repos hermanos; un AuthorityMap por encargo fija responsables para evitar doble efecto. **No se modifica agente.**

## Código (estado real)

```bash
npm ci             # instala desde package-lock.json
npm run typecheck
npm test           # 131 tests
npm run build      # ESM + .d.ts en cada workspace
npm run verify:parent   # tarballs + instalación + smoke + typecheck de consumidor
```

## Instalar en el repo padre

El monorepo no se publica en un registry: `npm run pack:parent` genera siete tarballs en `artifacts/parent-install/` (con `parent-install.json` y sha256) que se declaran como dependencias `file:` en el padre, o bien se instalan por ruta local tras `npm run build`. Guía completa, entrypoints y límites: [docs/integration/PARENT-REPO-INSTALL.md](docs/integration/PARENT-REPO-INSTALL.md).

La instalación se comprueba en un proyecto limpio que importa y **typechequea** los siete paquetes (`skipLibCheck: false`), sin tocar `/agente`.

## Vertical ejecutable

`@agntia/api` expone `POST/GET /v1/branding/verticals` y `POST /v1/branding/verticals/:id/stages/:stage`. Las etapas son estrictas y no se pueden saltar; cada una exige su capability, es idempotente por `operationKey` y devuelve `needs_input` con motivos cuando un gate determinista falla. La entrega requiere una aprobación humana provisionada y ligada al hash del manifest. Evidencia: [docs/execution-evidence/C40-VERTICAL-SLICES.md](docs/execution-evidence/C40-VERTICAL-SLICES.md).

| Paquete | Contenido |
|---|---|
| `packages/contracts` | Envelope, DTOs estrictos, dinero decimal, hashing canónico, errores normalizados |
| `packages/domain` | AuthorityMap, FSM, aprobaciones, brief→brandbook, derechos/fuentes, documento vectorial, tokens, QA, preflight, entrega, coste, privacidad, aceptación |
| `packages/identity` | Verificación JWT Supabase (JWKS fijo), membership/ACL, TwinBinding y mandato |
| `packages/persistence` | Stores tenant-scoped con CAS, audit append-only, outbox/inbox, idempotencia + migración SQL con RLS |
| `packages/adapters` | Discovery de capacidades, URLs firmadas, puertos Penpot/Anam (sin endpoints inventados) |
| `apps/api` | API Hono con PEP, envelope, idempotencia, errores normalizados, `VerticalService` de 12 etapas y aprobaciones humanas |
| `packages/sdk` | Cliente servidor tipado con allowlist de rutas |

No hay UI, ni proveedores conectados, ni base de datos provisionada. `not_configured` y `NOT_VERIFIED` se muestran como tales; ningún mock se presenta como integración real.

## Leer en orden

1. [Producto y capacidades](docs/01-producto.md), [investigación](docs/02-investigacion.md), [comparación](docs/03-referentes-y-brechas.md), [repos/licencias](docs/04-adaptadores.md).
2. [Arquitectura](docs/architecture/01-arquitectura.md), [Supabase/twins](docs/architecture/02-identidad-twins.md), [padre](docs/architecture/03-compatibilidad-agente.md), [runtime](docs/architecture/04-runtime.md), [contratos](docs/contracts/01-contratos.md).
3. [Seguridad](docs/05-seguridad-privacidad.md), [UX/Anam](docs/06-ux-anam.md), [SaaS/cooperación](docs/07-servicio.md), [coste](docs/08-costes.md), [evaluación](docs/09-evaluacion.md).
4. [42 campañas](docs/campaigns/README.md), [manifest](docs/campaigns/campaign.json), [handoff](docs/release/HANDOFF.md), [informe](docs/release/INFORME-AL-OWNER.md), [aceptación](docs/release/PILOT-ACCEPTANCE.md), [runbook](docs/operations/RUNBOOK.md).

Vertical propuesta: Brief sintético → investigación autorizada → conceptos → identidad verbal/visual → tokens → diseño editable → QA/rights → revisión humana → export sandbox → brandbook/hash.

Límite inicial: Sin registrar marca, prometer disponibilidad jurídica, copiar identidad de terceros, publicar/desplegar sin permiso, eliminar originales o usar fuentes/assets sin licencia. Generación IA es propuesta y no certifica autoría/exclusividad.

Fuentes primarias y repos por SHA: [sources](docs/research/sources.json), [repos](docs/research/repositories.json), [mapa padre](docs/research/parent-source-map.json). [Validación](docs/release/document-validation.json) comprueba documentos, no acredita producto. SHA del padre cotejado: `54b8d5407a8576459448c4d059a877297d18ca7a`.
