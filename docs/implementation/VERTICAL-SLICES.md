# Núcleo instalable y vertical slices

Este documento describe la capa que convierte el repositorio en algo que se
instala y se usa, y el mecanismo que permite desarrollar una vertical sin
encenderla antes de tiempo. No cambia el programa: siguen siendo 42 campañas,
294 tareas y 84 gates en `docs/campaigns/campaign.json`, intacto.

## Qué es una slice

Una slice es la unidad mínima desplegable del producto: las capacidades que una
vertical end-to-end necesita, no el registro entero. Vive en
`src/slices/registry.ts` y tiene un estado explícito:

| Estado | Significado | Se puede activar |
|---|---|---|
| `active` | implementada, verificada en local y encendida por defecto | sí (ya lo está) |
| `ready` | implementada, deliberadamente apagada hasta que existan sus dependencias | sí, por configuración |
| `blocked` | falta un proveedor o un contrato; no puede funcionar de verdad | no: falla cerrado |

El registro cubre las 24 capacidades del catálogo cerrado exactamente una vez.
Eso lo comprueban `node scripts/check-invariants.ts` y `test/slices.test.ts`; una
capacidad huérfana o duplicada rompe CI.

### Estado actual

| Slice | Estado | Capacidades | Campañas |
|---|---|---|---|
| `brief` | active | `brand.brief.propose` | C09 |
| `identity` | active | `brand.naming.propose`, `brand.voice.propose` | C11, C13 |
| `design` | active | `brand.concept.preview`, `brand.logo.propose`, `brand.design.preview`, `brand.layout.validate`, `brand.template.propose` | C14, C17, C19, C20, C24, C25, C26 |
| `rights` | active | `brand.rights.read`, `brand.font.preview` | C15, C16 |
| `documents` | active | `brand.document.update`, `brand.canvas.preview` | C17, C19 |
| `tokens` | active | `brand.palette.validate`, `brand.tokens.preview`, `brand.tokens.export` | C21, C22, C23 |
| `qa` | active | `brand.text.verify`, `brand.quality.evaluate` | C27, C28 |
| `brandbook` | active | `brand.brandbook.propose` | C29 |
| `research` | ready | `brand.research.preview`, `brand.clearance.preview` | C10, C12 |
| `export` | ready | `brand.export.preview` | C30 |
| `delivery` | ready | `brand.deliver.propose` | C31 |
| `learning` | ready | `brand.learning.propose` | C32 |
| `penpot` | blocked | `brand.penpot.preview` | C18 |

`active` no significa "terminada": significa que la capacidad existe, tiene test
local y la slice no depende de un proveedor ausente. El estado de cada campaña
sigue en [STATUS.md](STATUS.md).

## Activar una slice

La activación es configuración validada, nunca un flag oculto ni un fallback:

```bash
# sólo el core (por defecto)
node dist/cli.js slices

# encender una slice ready junto al core
AGNTIA_BRANDING_SLICES=brief,identity,design,rights,documents,tokens,qa,brandbook,research \
  node dist/cli.js serve
```

Reglas de la resolución (`resolveActivation`):

- Sin variable: se encienden exactamente las slices `active`.
- Una lista vacía (`AGNTIA_BRANDING_SLICES=,`) es un error, no "el defecto" ni
  "todo apagado".
- Un id desconocido impide arrancar (`invalid_input`).
- Una slice `blocked` impide arrancar (`policy_violation`) y devuelve sus
  blockers; no se activa "a medias".
- La lista es explícita: si se configura, sustituye al conjunto por defecto, no
  se suma a él.

El PEP consulta la activación resuelta en cada llamada. Una capacidad cuya slice
no está activa se deniega con `unsupported_capability` y `details.slice`, incluso
para un `owner`, y queda auditada como `blocked / slice_disabled`. La activación
no concede permisos: no sustituye a la capability del principal, al scope del
recurso, al mandato ni a la aprobación.

## Desarrollar una slice nueva

1. Declararla en `SLICES` con estado `ready` y sus `blockers` reales. Nada de
   `active` hasta que tenga test local y no dependa de un proveedor ausente.
2. Asignarle capacidades del catálogo cerrado. Si hace falta una capacidad
   nueva, se añade antes a `BRAND_CAPABILITY_NAMES` y `CAPABILITIES`, con riesgo,
   efecto externo y si exige aprobación.
3. Implementar el dominio y sus rutas detrás de la activación; la ruta no debe
   existir para un tenant si la slice está apagada.
4. Añadir los tests que prueben las dos caras: apagada deniega, encendida
   funciona con un principal autorizado.
5. El invariante `slices: cada capacidad pertenece a exactamente una slice` y
   `validateSliceRegistry()` dirán si falta algo.
6. Pasar la slice a `active` sólo cuando el blocker desaparezca de verdad.

## El núcleo instalable

```bash
npm ci                 # instala y compila (prepare → build)
npm run check:all      # typecheck + 133 tests + 9 invariantes + build
npm run check:package  # pack + install en proyecto vacío + CLI + import ESM
```

El paquete expone:

- `main`/`types` → `dist/index.js` y `dist/index.d.ts` (build con `tsc` y
  `rewriteRelativeImportExtensions`, sin bundler ni segunda copia del código).
- `bin` → `agntia-branding` (`dist/cli.js`).
- `files` → `dist`, `README.md`, `LICENSE`; el SQL revisado viaja en `dist/db`.
- `private: true`: el paquete es instalable por tarball o por git, pero no se
  publica en un registro sin una decisión explícita.

### CLI

| Comando | Qué hace |
|---|---|
| `doctor [--json]` | Comprueba Node, registro de slices, configuración, JWT, base de datos y proveedores. `NOT_CONFIGURED` no es `FAIL`. |
| `slices [--json]` | Lista las 13 slices, su estado, sus blockers y su siguiente paso. |
| `capabilities [--json]` | Lista las 24 capacidades con su slice, riesgo y si están encendidas. |
| `serve` | Levanta la API HTTP en desarrollo. Sin JWT o en producción sale con código 2. |
| `render <input.json>` | Renderiza PDF/PNG/SVG desde `{document, manifest, rights}`; sin `--accept-findings` no emite bytes si hay sustituciones. |
| `migrate`, `seed` | Aplican el SQL revisado; sin `DATABASE_URL` salen con 2 y `NOT_CONFIGURED`. |
| `version`, `help` | Sin configuración. |

Códigos de salida: `0` correcto, `1` error, `2` no configurado.

### Configuración

| Variable | Uso |
|---|---|
| `AGNTIA_BRANDING_MODE` | `development` (defecto), `test`, `production` |
| `AGNTIA_BRANDING_HOST` / `_PORT` | bind (defecto `127.0.0.1:8787`) |
| `AGNTIA_BRANDING_SLICES` | lista explícita de slices a encender |
| `AGNTIA_BRANDING_JWT_ISSUER` / `_AUDIENCE` | emisor y audiencia esperados |
| `AGNTIA_BRANDING_JWT_SECRET` | HS256 sólo en desarrollo/test; en producción se rechaza |
| `AGNTIA_BRANDING_JWKS_URL` | verificación asimétrica en producción |
| `AGNTIA_BRANDING_MEMBERSHIPS` | fixture local de membresías; prohibida en producción |
| `DATABASE_URL` | DSN de Postgres para `migrate`/`seed` |

## Límites que esta capa no elimina

- **No hay adaptador Postgres del store.** `serve` se niega a arrancar en
  `production` con el store en memoria, en vez de fingir persistencia.
- **No hay proveedores**: Penpot, Anam y el gateway de modelos siguen
  `not_configured`; `penpot` no se puede activar.
- **`brand.export.preview` no está cableada en HTTP**: el renderer y el
  manifiesto existen y producen bytes, pero la descarga autenticada y el flujo
  de aprobación son el siguiente paso de la slice `export`.
- **El paquete no está publicado**: `private: true` es deliberado.

La prueba de instalación es `scripts/package-smoke.ts` y corre en CI: empaqueta,
instala el tarball en un proyecto vacío, ejecuta `doctor --json` desde
`node_modules` e importa la API ESM. Un build que compila no es un paquete que se
instala, y esta comprobación no lo confunde.
