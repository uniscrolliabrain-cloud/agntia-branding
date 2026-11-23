# Instalar agntia-branding en el repo padre

**Estado:** instalación local verificada (build + tarballs + consumidor TS limpio). **El repo padre `/agente` no se ha tocado**, así que la integración real sigue `NOT_VERIFIED` hasta que el padre instale y ejecute estos paquetes.

Este documento describe cómo consumir el monorepo desde otro repositorio sin copiar fuentes TypeScript ni publicar en un registry.

## Qué se instala

Los paquetes son ESM con `dist/` compilado y declaraciones `.d.ts`. `private: true` impide publicarlos en npm; se instalan por tarball o por ruta local.

| Paquete | Entrypoints | Dependencias externas |
|---|---|---|
| `@agntia/contracts` | `.` | `zod` |
| `@agntia/domain` | `.` | `@agntia/contracts`, `zod` |
| `@agntia/identity` | `.` | `@agntia/contracts` |
| `@agntia/persistence` | `.` + `migrations/0001_init.sql` en el tarball | `@agntia/contracts`, `@agntia/domain` |
| `@agntia/adapters` | `.` | `@agntia/contracts`, `@agntia/domain` |
| `@agntia/sdk` | `.` | `@agntia/contracts`, `@agntia/domain` |
| `@agntia/api` | `.` (`createApp`), `./service` (`BrandingService`), `./verticals` (`VerticalService`), `./server` | `hono` + paquetes anteriores |

Requisitos: Node.js >= 20.11, ESM (`"type": "module"`), Zod 3, Hono 4.

## Opción A · tarballs (recomendada)

En este repo:

```bash
npm ci
npm run verify:parent   # build + pack + instalación + smoke + typecheck de consumidor
```

`npm run verify:parent` genera en `artifacts/parent-install/`:

```text
agntia-contracts-0.1.0.tgz
agntia-domain-0.1.0.tgz
agntia-identity-0.1.0.tgz
agntia-persistence-0.1.0.tgz
agntia-adapters-0.1.0.tgz
agntia-sdk-0.1.0.tgz
agntia-api-0.1.0.tgz
parent-install.json   # nombre, versión, bytes y sha256 de cada tarball
```

`artifacts/` está en `.gitignore`: son artefactos de build, no releases. Copia los `.tgz` a una ruta estable (o genera el manifest en CI) y en el `package.json` del padre:

```json
{
  "dependencies": {
    "@agntia/api": "file:./vendor/agntia/agntia-api-0.1.0.tgz",
    "@agntia/contracts": "file:./vendor/agntia/agntia-contracts-0.1.0.tgz",
    "@agntia/domain": "file:./vendor/agntia/agntia-domain-0.1.0.tgz",
    "@agntia/identity": "file:./vendor/agntia/agntia-identity-0.1.0.tgz",
    "@agntia/persistence": "file:./vendor/agntia/agntia-persistence-0.1.0.tgz",
    "@agntia/adapters": "file:./vendor/agntia/agntia-adapters-0.1.0.tgz",
    "@agntia/sdk": "file:./vendor/agntia/agntia-sdk-0.1.0.tgz"
  }
}
```

Declara los siete tarballs juntos: las dependencias internas usan la misma versión `0.1.0` y npm resuelve el árbol con los `file:` provistos. Después: `npm install`.

## Opción B · checkout local

Si el padre tiene este repo como hermano (`../agntia-branding`):

```bash
cd ../agntia-branding && npm ci && npm run build
```

y en el padre:

```json
{ "dependencies": { "@agntia/api": "file:../agntia-branding/apps/api" } }
```

npm instala solo ese paquete; añade también los otros seis como `file:` si el padre los importa directamente. `dist/` no está en Git, así que hay que reconstruir tras cada `git pull`.

## Cómo se integra en el padre

```ts
import { SupabaseJwtVerifier, type Membership } from "@agntia/identity";
import { createApp } from "@agntia/api";
import { BrandingService } from "@agntia/api/service";

const verifier = new SupabaseJwtVerifier({
  issuer: process.env.SUPABASE_ISSUER!,       // sin valores por defecto
  audience: process.env.SUPABASE_AUDIENCE!,
  jwksUrl: process.env.SUPABASE_JWKS_URL!,
});

// Membership provisionada por el padre (DB), nunca user_metadata del token.
const memberships: Membership[] = await loadMembershipsFromDatabase();

const service = new BrandingService();
const app = createApp({ verifier, memberships, service });
```

Reglas que el padre no puede relajar:

- Conectar a Postgres como `branding_api`/`branding_worker`, **no** como owner ni `service_role`: un superusuario bypasea RLS.
- Fijar `request.jwt.claims` con `SET LOCAL` dentro de la transacción, nunca con `SET` de sesión (riesgo de pooling).
- Aplicar `node_modules/@agntia/persistence/migrations/0001_init.sql` en una base vacía antes de usar los stores SQL. La implementación actual del servicio usa stores en memoria; el SQL está verificado con PGlite, no contra Supabase gestionado.
- No exponer el servicio con `BRANDING_MEMBERSHIPS_JSON` en producción: `apps/api/src/server.ts` lo acepta solo como configuración de desarrollo.

Variables requeridas por el servidor de referencia (nombres, sin valores): `SUPABASE_ISSUER`, `SUPABASE_AUDIENCE`, `SUPABASE_JWKS_URL`; opcionales `PORT`, `BRANDING_MEMBERSHIPS_JSON` (solo dev).

## Vertical ejecutable (C40)

El paquete `@agntia/api` incluye `VerticalService`, expuesto por HTTP:

| Método | Ruta | Efecto |
|---|---|---|
| `POST` | `/v1/branding/verticals` | crea la vertical (`resourceId`, `documentId`) |
| `GET` | `/v1/branding/verticals/:id` | lee estado, etapa siguiente y artefactos |
| `POST` | `/v1/branding/verticals/:id/stages/:stage` | ejecuta una etapa con `operationKey` |
| `POST` | `/v1/branding/approvals` | aprobación humana provisionada, ligada a hash |

Etapas, en orden estricto: `brief → research → naming → clearance → voice → tokens → design → qa → review → export → delivery → brandbook`.

Cada etapa exige la capability ACL correspondiente (`brand.brief.propose`, `brand.research.preview`, `brand.document.update`, `brand.review.decide`, `brand.export.preview`, `brand.deliver.propose`). Saltarse una etapa devuelve `409`; una etapa con gates incumplidos devuelve `200` con `status: "needs_input"` y no avanza. La aprobación de entrega la emite un revisor humano distinto del proponente; el cuerpo de la petición no puede declarar competencia ni rol.

## Verificación ejecutada (2026-11-23)

```text
npm run build
[build] 7 packages built, no .ts specifiers in dist

npm run verify:parent
[pack] 7 tarballs + parent-install.json in artifacts/parent-install
added 9 packages in 1s
PARENT_INSTALL_SMOKE PASS
[verify:parent] PASS · 7 packages installed, imported and typechecked
```

El consumidor de prueba declara `skipLibCheck: false`, `strict: true` y `noUncheckedIndexedAccess: true`, e importa los siete paquetes (incluidos `@agntia/api/service` y `@agntia/api/verticals`). El smoke ejecuta `/health`, comprueba `401` en rutas privadas, y ejercita contratos, dominio, identidad, persistencia y la creación de la app.

## Lo que sigue sin verificar

- Instalación y ejecución reales desde `/agente` (no se modificó el padre ni se abrió un PR allí).
- Publicación en un registry privado (los paquetes son `private`).
- Stores SQL conectados a Supabase/Postgres reales; la app sigue usando memoria.
- JWT emitido por un proyecto Supabase real, PostgREST, pooler y concurrencia de claims.
- Proveedores Penpot/Anam, UI, render y despliegue.
