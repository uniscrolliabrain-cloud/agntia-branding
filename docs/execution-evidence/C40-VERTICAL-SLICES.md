# C40 · Vertical E2E ejecutable y cortes verticales

**Fecha:** 2026-11-23 · **Artefactos:** `apps/api/src/verticals.ts`, rutas en `apps/api/src/app.ts`, `tests/verticals.test.ts`
**Comando:** `npm test` · **Resultado:** 131/131 tests en verde (12 archivos), 9 de ellos nuevos de vertical.

## Qué se ha implementado

Una vertical P0 ejecutable de 12 etapas, en orden estricto, sobre HTTP y con estado por tenant:

`brief → research → naming → clearance → voice → tokens → design → qa → review → export → delivery → brandbook`

Cada etapa:

- exige la capability ACL de la etapa y un `operationKey` idempotente;
- reutiliza el dominio determinista (no duplica reglas): `proposeBrief`, `assertNoEmbeddedDirectives`, `assertResearchUsable`, `proposeNameCandidates`, `evaluateClearance`, `validateVoiceProfile`, `validateTokenSet`, `buildTokens`, `evaluatePalette`, `documentHash`, `verifyText`, `evaluateQualityGate`, `preflightExport`, `brandbookPayloadHash`;
- persiste su artefacto y devuelve `needs_input` con motivos cuando un gate no pasa, sin avanzar la etapa;
- escribe auditoría con actor, recurso, versión y hash del payload.

La entidad es tenant-scoped: otro tenant recibe `404` al leer o avanzar, igual que en los stores existentes.

## Gates demostrados por los tests

| Escenario | Resultado esperado | Test |
|---|---|---|
| Vertical completa con aprobación humana y receipt | `completed`, 12 etapas, outbox y auditoría | `recorre brief → brandbook…` |
| Brief sin propósito | `needs_input`, no permite research | `un brief sin propósito…` |
| Clearance con clases incompletas pese a “no conflicto” | `needs_input`, sigue en clearance | `clearance con cobertura incompleta…` |
| Contraste WCAG insuficiente | `needs_input` con `contrast:body` | `tokens con contraste insuficiente…` |
| Texto renderizado distinto del fuente | QA bloquea y review devuelve `409` | `texto renderizado distinto…` |
| Edición del documento tras la revisión | export devuelve `409` (aprobación invalidada) | `un cambio del documento tras la revisión…` |
| Proponente intentando aprobar su entrega | `403` | `el proponente no puede aprobar…` |
| Otro tenant leyendo/avanzando | `404` | `otro tenant no puede…` |
| Etapa desconocida / fuera de orden | `400` / `409` | `una etapa desconocida o fuera de orden…` |
| Replay con el mismo `operationKey` | misma versión, sin reejecutar | incluido en el recorrido completo |

Además, la ruta de aprobaciones deriva rol y competencia del membership provisionado (nunca del cuerpo) y rechaza `expiresAt` en el pasado y al proponente como aprobador.

## Cómo se ejecuta

```bash
npm test
# 12 archivos, 131 tests
```

Nueve tests nuevos en `tests/verticals.test.ts`. El recorrido completo se hace con `app.request` sobre el mismo `createApp` que sirve el servidor, con JWT sintéticos y dos tenants; no es un mock de la capa HTTP, pero tampoco es un servidor desplegado.

## Límites (sin adornos)

- **Estado en memoria:** `VerticalService` y `BrandingService` no persisten en Postgres. La migración RLS existe y está verificada con PGlite, pero la vertical no la usa todavía.
- **Sin proveedores:** Penpot, Anam y render real siguen `not_configured`; la etapa de diseño opera sobre el documento vectorial canónico, no sobre un editor externo.
- **Sin UI:** no hay portal ni visor; las etapas se ejercitan por API.
- **Sin servidor levantado:** los tests usan `app.request`, no un socket HTTP real. El arranque exige variables de Supabase y no se ejecutó.
- **Aprobación de entrega:** es un segundo acto humano distinto de la revisión de diseño; la vertical no la crea automáticamente. Si el cliente no la aporta, `delivery` devuelve `not_found`.
- **Concurrencia:** la idempotencia es en memoria y single-process; no cubre dos workers compitiendo sobre la misma vertical.
- **C40 sigue siendo `PASS_LOCAL`**, no un gate de producto: no hay proveedor, DB real ni UI que lo cierren.
