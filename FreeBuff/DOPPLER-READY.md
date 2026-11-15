# Doppler-ready — catálogo de variables y secretos (diseño)

**2026-11-15 · PROPUESTA, NO CONFIGURACIÓN.** No se ha creado ningún proyecto Doppler, no se ha instalado ningún secreto y no se ha contactado ningún proveedor. Este documento existe porque el corpus no tenía catálogo de variables (discrepancia **D7** de `AUDITORIA-BASELINE-20261115.md`) y C08 exige un contrato de secretos antes de implementar.

Ningún valor, token, DSN o clave aparece aquí. Solo nombres, ámbito, lector autorizado, formato esperado y comportamiento al faltar.

## Principios de arranque seguro

1. **Solo servidor.** Ninguna variable de este catálogo se expone al navegador ni al modelo. El cliente recibe únicamente refs y estado.
2. **Fail-closed.** Variable ausente ⇒ capacidad `disabled` con `not_configured`. Nunca `default`, `owner` ni `admin` por conveniencia.
3. **Sin fallback silencioso.** Si falta una fuente tipográfica o un proveedor, el render falla con motivo visible; no sustituye por otra familia ni por otro proveedor.
4. **Credenciales por tenant fuera del entorno.** Los secretos de un cliente concreto viven en `ProviderConnection.secretRef` (custodia de servidor), no como variable global. El entorno solo contiene la clave de descifrado/gestión y refs.
5. **Un secreto, un lector.** Cada variable declara el proceso que la lee (API, worker, render, export, bridge). El modelo no lee ninguna.
6. **Prohibido en Git, logs, reportes, prompts y trazas.** Los errores se sanitizan antes de emitir; correlación por ID, no por payload.

## Entornos

| Entorno | Proyecto Doppler | Uso | Datos |
|---|---|---|---|
| `dev` | `agntia-branding/dev` | Máquina de desarrollo, previews locales | Fixtures sintéticos A/B/P |
| `stg` | `agntia-branding/stg` | Piloto, dos tenants sintéticos, E2E | Sintéticos, jamás reales |
| `prd` | `agntia-branding/prd` | Sólo tras aceptación explícita del owner | Reales, con base legal y retención definidas |

Ramas de configuración por PR: `dev_pr_<n>` derivada de `dev`, para que un cambio de contrato no toque `stg` hasta merge. `prd` no admite ramas de feature.

## Catálogo

### Identidad, autenticación y base de datos

| Variable | Ámbito | Lector | Formato | Rotación | Si falta |
|---|---|---|---|---|---|
| `SUPABASE_URL` | global | API, worker | URL https del proyecto autorizado | con el proyecto | `auth.verify` deshabilitado; 503 fail-closed |
| `SUPABASE_JWKS_URL` | global | API | URL fijada por servidor (no `jku` del token) | automática por JWKS | Sin verificación de firma ⇒ no se acepta ningún JWT |
| `SUPABASE_JWT_AUDIENCE` | global | API | string exacto del proyecto | con el proyecto | Rechazo de todos los tokens (`aud` no comprobable) |
| `SUPABASE_JWT_ISSUER` | global | API | URL exacta del issuer | con el proyecto | Rechazo; nunca «issuer libre» |
| `SUPABASE_JWT_LEGACY_SECRET` | global, **solo si** HS256 legacy | API | secreto simétrico | 90 días o incidente | HS256 deshabilitado; se exige asimétrico |
| `DATABASE_URL` | global | API, worker | DSN Postgres con rol de servicio mínimo | 90 días | Sin persistencia ⇒ ninguna campaña de estado avanza |
| `API_DB_ROLE` / `WORKER_DB_ROLE` | global | API / worker | nombre de rol **sin** `BYPASSRLS` | con la migración | Arranque abortado: RLS no verificable |
| `SUPABASE_SERVICE_ROLE_KEY` | global, uso restringido | solo migraciones/administración | clave de servicio | 30–90 días | Migraciones deshabilitadas. **Nunca** se usa como sustituto de RLS ni en API de negocio |

> `service_role` **no** es garantía de aislamiento. Toda consulta de negocio usa rol con RLS y scope de tenant/recurso; el aislamiento se prueba también con la credencial administrativa (§Pruebas).

### Proveedores de dominio (por tenant, vía ref)

| Variable | Ámbito | Lector | Notas |
|---|---|---|---|
| `PROVIDER_SECRET_KEK` | global | API, worker | Clave de sobre/gestión para descifrar `secretRef` por tenant; rotación con re-cifrado por lotes |
| `PENPOT_BASE_URL` | por conexión | adaptador Penpot | EndpointRef de servidor; jamás URL del modelo |
| `PENPOT_CLIENT_ID` / `PENPOT_CLIENT_SECRET` | por conexión | adaptador Penpot | OAuth de la instalación; scope mínimo por team/project |
| `PENPOT_TEAM_BINDING_REF` | por tenant | adaptador Penpot | Referencia al binding remoto; no un nombre libre |
| `ASSET_STORAGE_ENDPOINT` / `ASSET_STORAGE_BUCKET` | global | API, render, export | Prefijo por tenant obligatorio |
| `ASSET_STORAGE_ACCESS_KEY_ID` / `ASSET_STORAGE_SECRET_ACCESS_KEY` | global | API, worker | Rotación 90 días; URLs firmadas caducables |
| `FONT_SOURCE_MANIFEST_REF` | global | render | Manifiesto de familias con licencia **leída**; una familia `UNKNOWN` queda deshabilitada |
| `STYLE_DICTIONARY_VERSION` | global | export | Versión fijada; sin transforms libres del agente |

### Modelo, presencia y coste

| Variable | Ámbito | Lector | Notas |
|---|---|---|---|
| `MODEL_GATEWAY_URL` | global | API, worker | Gateway propio; **no** endpoint libre por petición |
| `MODEL_ALLOWLIST_REF` | global | gateway | Configuración aprobada por tarea/idioma/región/retención/coste |
| `MODEL_PROVIDER_KEY` | global | gateway | Una clave por proveedor aprobado; rotación 90 días |
| `BUDGET_RESERVATION_ENABLED` | global | API, worker | Debe ser `true` en `stg`/`prd`; si falta, no hay efecto de pago |
| `ANAM_API_KEY` / `ANAM_APP_ID` | global | API (presencia) | Presencia únicamente: **no** identidad, permiso ni firma |
| `AV_SESSION_MAX_MINUTES` | global | API | Límite de duración; sin él, sesión AV deshabilitada |

### Observabilidad, outbox y bridge

| Variable | Ámbito | Lector | Notas |
|---|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | global | todos | Telemetría, **no** ledger de evidencia |
| `LOG_REDACTION_PROFILE` | global | todos | Perfil de redacción obligatorio; sin él no se emiten logs con campos de cliente |
| `OUTBOX_POLL_INTERVAL_MS` / `OUTBOX_MAX_ATTEMPTS` | global | worker | Reintentos finitos; agotados ⇒ dead-letter con causa |
| `RECONCILIATION_LOOKUP_TIMEOUT_MS` | global | worker | Tras timeout con posible efecto: reconciliar, no reintentar con otra key |
| `BRIDGE_PARENT_BASE_URL` | global | bridge | Endpoint del padre; **solo lectura de contratos** en v1 |
| `BRIDGE_PARENT_CLIENT_ID` / `BRIDGE_PARENT_JWKS_URL` | global | bridge | Verificación de eventos/órdenes del padre |
| `BRIDGE_SIGNING_KEY` | global | bridge | Firma de salida del middleware; rotación 90 días |
| `FEATURE_FLAGS_REF` | global | API, worker | Kill-switch por capacidad; apagar detiene efectos nuevos sin borrar evidencia |

## Reglas de custodia y permisos en Doppler

- **Lectura de `prd`**: sólo el owner y el responsable de operación; lectura de `stg`/`dev` para el equipo de implementación. Sin acceso de lectura a `prd` para agentes automáticos.
- **Escritura**: un único responsable humano de secretos. Un agente nunca escribe en `prd`.
- **Separación de funciones**: quien despliega no aprueba el secreto de producción; quien lo crea no lo aprueba solo.
- **Rotación**: JWKS automática; claves de proveedor 90 días; `DATABASE_URL` 90 días; credenciales de tenant al cerrar contrato o ante incidente; `BRIDGE_SIGNING_KEY` 90 días con solapamiento.
- **Revocación**: al suspender un tenant se revocan sus `secretRef`, mandatos y sesiones AV antes de cualquier nuevo efecto. No se reanuda por conversación previa.
- **Salida de cliente**: revocar secretos, mandatos y URLs firmadas; conservar audit y evidencia; no reenviar histórico al migrar backend.

## Comportamiento al faltar una variable (fail-closed)

| Falta | Efecto observable |
|---|---|
| Verificación JWT (URL/JWKS/aud/issuer) | 100 % de peticiones rechazadas con 401/503; ninguna capability operativa |
| `DATABASE_URL` o rol sin RLS | Arranque abortado, no arranque degradado |
| `PROVIDER_SECRET_KEK` | Conexiones existentes quedan `not_configured`; sin lecturas remotas |
| `MODEL_GATEWAY_URL` / allowlist | Propuestas deshabilitadas; preview local determinista sigue funcionando |
| `ANAM_API_KEY` | Fallback a texto **si la política lo permite**; nunca se simula presencia |
| Manifiesto de fuentes | Render bloqueado con motivo `font_license_unverified`; sin fallback silencioso |
| `FEATURE_FLAGS_REF` | Capacidad de efecto deshabilitada; diagnóstico legible, sin admin por defecto |

## Pruebas que un entorno debe poder demostrar (NOT_EXECUTED)

Todas quedan `NOT_EXECUTED`: no hay runtime ni proyecto Supabase/Doppler creado.

1. Token de **otro** proyecto Supabase: firma/issuer/audience fallan ⇒ 401.
2. `alg: none` / `HS256` con clave pública: rechazo.
3. Token caducado y `nbf` futuro: rechazo.
4. JWT válido **sin** membership provisionada: 403, no owner implícito.
5. `user_metadata` manipulado con `tenant_id` ajeno: sin efecto.
6. Rol `service_role` en consulta de negocio: el aislamiento sigue vigente (RLS no evadible por convención).
7. Rotación de JWKS con caché caliente: sin ventana de tokens aceptados tras revocación.
8. Secreto centinela: 0 apariciones en logs, trazas, errores y reportes.
9. Tenant suspendido con job en cola: el worker revalida y no ejecuta.
10. `prd` sin `BUDGET_RESERVATION_ENABLED=true`: ninguna operación de coste se autoriza.

## Lo que este documento no hace

- No crea proyectos, no instala secretos, no activa proveedores, no firma contratos, no gasta.
- No fija tarifas ni planes: las bolsas 30/70/300 € son hipótesis de `docs/08-costes.md`, no precios contratados.
- No sustituye la lectura de licencias por familia tipográfica ni la revisión jurídica de derechos de activos.
