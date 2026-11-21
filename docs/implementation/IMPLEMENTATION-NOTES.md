# Notas de implementación

2026-11-15. Este documento explica **cómo** está construido lo que existe y qué
desviaciones conscientes hay respecto del diseño original. El estado por campaña
está en [STATUS.md](STATUS.md); aquí se justifican las decisiones.

## Estructura real

```
src/
  contracts/     errores, sobres, EvidenceRef, registro cerrado de capacidades
  auth/          verificación JWT (node:crypto + JWKS), principal, actor
  policy/        ApprovalBinding, DelegationMandate, PEP (un único punto de decisión)
  runtime/       intents idempotentes, outbox/inbox, FSM de handoff
  domain/        brief/naming/clearance/voz/logo/plantillas/brandbook, documento,
                 canvas SVG, paleta, tokens, derechos, QA, export/preflight, learning, reports
  adapters/      informes de capacidad, fetch anti-SSRF, stubs Penpot/Anam/gateway
  api/           handler Web estándar para /v1/branding
  sdk/           cliente tipado sobre las rutas nominadas
  store/         almacén en memoria con clave por tenant (espejo de la RLS)
  db/            schema.sql (18 tablas, RLS, FK compuestas), migrate.ts, seed.ts
  cost/          reserva y liquidación con decimales exactos
  obs/           ADTC, proyección a SystemEvent, redacción de logs
test/            133 casos (auth, policy, runtime, domain, export, api, adversarial, e2e, config, slices, cli, server)
scripts/         check-invariants.ts, generate-evidence.ts, render-smoke.ts, copy-assets.ts, package-smoke.ts
```

## Desviaciones conscientes y por qué

| Diseño original | Implementado | Motivo |
|---|---|---|
| Monorepo `pnpm` con `packages/*` y `apps/*` | Un paquete ESM con carpetas por capa | Un solo consumidor hoy; añadir workspaces sin segundo consumidor es ceremonia. Las fronteras se mantienen por carpeta y por imports explícitos. |
| API sobre Hono | Handler `Request → Response` estándar | Cero dependencias y portabilidad a Workers; Hono puede montarse encima sin cambiar la lógica. |
| Contratos Zod | Zod (una dependencia de runtime) | Es el contrato que el diseño nombra; se usa `.strict()` en todos los esquemas. |
| Render determinista con motor propio | Identidad de render por `engine + engineVersion + fontHash + hash del documento` | Sin rasterizador no hay bytes; lo que sí existe es la **atribución** del render a una versión, que es lo que el gate exige. |
| Style Dictionary como motor | Export con la forma de Style Dictionary, puro y reproducible | No se instala el motor para no heredar transforms no auditados; el formato emitido es el mismo contrato de datos. |
| Postgres con driver | `psql` sobre `src/db/schema.sql` | El SQL que revisa un DBA es el que se ejecuta; sin `DATABASE_URL` el proceso sale con `NOT_CONFIGURED`. |
| Portal + chat + Anam | No implementado | Requiere UI, canal AV y proveedor. Declararlo hecho sería mentir. |
| Mocks de proveedor | Informes `not_configured` y rechazo de operaciones no verificadas | Un fake que «funciona» oculta un contrato ausente. |

## Reglas que el código hace imposibles, no solo difíciles

- Fijar `tenantId`/`actorId` desde el cuerpo de la petición (400 explícito).
- Aprobar el propio efecto del proponente.
- Usar una aprobación cuyo `payloadHash`, versión, derechos, destinatario o caducidad ya no coinciden.
- Ampliar un mandato desde el propio twin.
- Reintentar a ciegas tras un resultado desconocido.
- Exportar con una tipografía sin licencia verificada o con derechos caducados.
- Meter un `<script>`, un `on*`, una entidad XML o una URL externa en un SVG.
- Publicar un brandbook con un activo en borrador.
- Activar un procedimiento aprendido sin replay y sin revisor distinto.
- Proyectar al padre un «confirmado» sin receipt.
- Acreditar un handoff completado sin ACK del receptor.
- Dar un gate por pasado usando un mock.

## Cómo se verifica

```bash
npm ci
npm run typecheck                                   # tsc --noEmit → 0 errores
npm test                                            # node --test test/ → 133/133
npm run test:db                                     # RLS real: levanta PostgreSQL efímero, 7/7
node scripts/check-invariants.ts                    # 9/9 (RLS, secretos, programa 42/294/84, slices, paquete)
npm run build                                       # dist/ con JS, .d.ts y SQL revisado
npm run check:package                               # pack + install en proyecto vacío + CLI + ESM
node scripts/generate-evidence.ts                   # regenera cNN/* y STATUS.md
```

`migrate` y `seed` requieren `DATABASE_URL`; sin él terminan con código 2 y
`NOT_CONFIGURED` en vez de fingir que aplicaron el esquema.

## Persistencia: cómo se demuestra la RLS

`test/db-rls.test.ts` arranca un clúster PostgreSQL 18 efímero (`.embedded-postgres`,
binarios por npm, sin root ni Docker), aplica `schema.sql` y `seed.sql` y comprueba:

- A y B sólo ven sus propias filas con el rol `app_api`;
- un `INSERT` con el tenant del otro se rechaza por `WITH CHECK` (SQLSTATE 42501);
- sin `app.tenant_id` en la sesión no se ve ninguna fila;
- `app_worker` puede leer pero no `DELETE`;
- la FK compuesta `(tenant_id, document_id)` impide enlazar un documento ajeno (23503);
- la tabla `tenants` sólo expone el tenant propio.

Límite explícito: `postgres` es superusuario y **evade RLS aunque haya FORCE**. Por eso
la aplicación usa `app_api`/`app_worker` y nunca un superusuario ni `service_role`.

## Render: qué sustituye y por qué lo dice

`src/domain/render.ts` escribe PDF 1.4 (con tabla xref), PNG (IHDR/pHYs/IDAT con
deflate) y SVG desde el `DesignDocument`, sin dependencias ni red. Es determinista:
mismos nodos, mismos bytes.

No puede embeber una fuente que no tiene, así que el PDF referencia Helvetica
base-14 y el PNG usa un bitmap 5x7 propio. Ambas cosas son sustituciones:
`renderDocument` devuelve `findings` y **lanza en vez de escribir el archivo** si
el llamante no pasa `acceptFindings: true`. Ese es el "font fallback no
silencioso" de C16 aplicado al borde de salida.

Lo que el modelo no puede dibujar con verdad (`path`, `image`, `group`) falla con
`unsupported_operation` y el id del nodo, en lugar de desaparecer del render.

`node scripts/render-smoke.ts` deja tres archivos en `artifacts/render/` con su
sha256 para inspección humana.

## Pixel diff: fidelidad medida

`src/domain/pixeldiff.ts` compara dos rasterizaciones con tolerancia declarada
(por canal, nunca "parecido") y devuelve píxeles distintos, ratio y caja del
cambio. Además cruza el diff de documento con el de píxeles: un nodo que cambió
y no aparece en la imagen se reporta como `invisible_change` y
`assertRenderChangeVisible` lo convierte en error, porque un cambio aprobado que
nadie ve es un defecto, no una advertencia. Comparar resoluciones distintas se
rechaza en lugar de promediarse.

## Qué no se ha hecho aquí

- Aplicar el esquema a un entorno gestionado (Supabase) con credenciales reales.
- Configurar Supabase, Penpot, Anam o un gateway de modelos.
- Generar bytes PDF/PNG/SVG reales.
- Construir portal, chat ni sesión AV.
- Desplegar nada, ni tocar `agente` o repos hermanos.
- Auditar licencias de fuentes por familia.

Todo eso está declarado como pendiente en la campaña correspondiente.
