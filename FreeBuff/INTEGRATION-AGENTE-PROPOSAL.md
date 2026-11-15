# Propuesta de integración con `agente` — agntia-branding

**2026-11-15 · PROPUESTA DOCUMENTAL. Cero cambios en el padre.** No se han creado claims, enums, rutas, paquetes ni configuración en `uniscrolliabrain-cloud/agente`, y no se ha instalado nada. Cualquier modificación del padre requiere un encargo separado y autorización del fundador.

Estado del bridge: **`HOST_BRIDGE_NOT_VERIFIED`**. El padre observado es `54b8d5407a8576459448c4d059a877297d18ca7a` (referencia histórica, **no** revalidada contra HEAD actual; ver D6).

## 1. Principio de autoridad

- El **agente canónico** vive en el padre: identidad, kernel, bus, grafo, SOPs, policy, memoria, rota empresarial.
- En este repositorio vive un **twin delegado**: propone, razona y ejecuta sólo dentro de un mandato acotado y revocable.
- El twin **no** crea identidad soberana, **no** registra empleados, **no** copia memorias privadas entre clientes y **no** comparte scheduler.
- Un nombre, avatar, persona o rol **no** concede permisos. Anam es presencia, nunca identidad ni firma.

## 2. Mapa de contratos heredados (a re-cotejar en C01)

| Concepto en este repo | Fuente nativa del padre | Qué debe verificarse antes de integrar |
|---|---|---|
| Principal verificado | `actor.ts`, `jwt.ts`/auth | Resolución de `sub`, `tenant_id`, `app_metadata`; prohibición de `user_metadata` como autoridad |
| Contexto de tenant | `tenant-principal`, `scope`, `db-tenant` | Que el fallback legacy del padre **no** se copie como permiso del servicio |
| Procedencia | `business.ts` | `source`/`actor`/`updatedAt`/`schemaVersion` preservados; `confidence` no es permiso |
| Delegación de tarea | `agent.ts` | `assignedBy`/`assignedTo` separados; `requestId`/`evidence`/`outcome` trazables |
| Capacidad | `capability.ts` | `risk`/`sideEffects`/`requiresApproval`/`idempotency` declarados **no** son garantía del backend |
| Resultado | `outcome.ts` | `achieved/partial/blocked/failed/unknown`; `unverified` por defecto |
| Verificación | `verification.ts` | Verificación lingüística no sustituye autorización ni competencia profesional |
| Eventos | `events/types.ts` | `SystemEvent` con `schemaVersion` string `"1.0"`, `emittedAt`, `owner`, `source` permitido |
| Formularios | `form-spec.ts` | Un chip visual no autoriza lectura ni confirma el dato |
| Aprendizaje | `learning.ts` | Aprendizaje procedural del padre ≠ perfil del cliente; `proposed→approved→active` |

Si el host no ofrece un puerto necesario, el resultado es `HOST_BRIDGE_NOT_VERIFIED` con fake **marcado como fake**. No se fabrica aprobación, runtime ni identidad paralela.

## 3. Identidad y delegación

### JWT Supabase (todos los modos, incluido portal externo)

- Firma y algoritmo verificados; asimétrico preferido. `alg: none` y confusión de clave: rechazo.
- `issuer`/`audience` exactos del proyecto autorizado; `exp`/`nbf` comprobados.
- JWKS por endpoint fijado por **servidor**; nunca `jku`/issuer tomado del token; caché limitada y rotación probada.
- `role: authenticated` no implica owner ni profesional del dominio.
- Claims conservados: `sub`, `tenant_id`, `app_metadata.tenant_id`. `user_metadata` editable **no** otorga autoridad.
- **JWT válido sin membership provisionada no autoriza.** Sin fallback `default`/`owner`.
- Token firmado puede estar obsoleto: revocación/suspensión se revalida antes de acceso sensible o efecto.

### TwinBinding (nuevo, del servicio)

| Campo | Contenido |
|---|---|
| `canonicalAgentRef` | ID/revisión del agente canónico en el padre (referencia, no campo inventado) |
| `localInstanceId` | Instancia local versionada del especialista |
| `targetTenantId` | Tenant sobre el que se actúa |
| `operatorTenantId` | Tenant de origen del operador (se conserva separado) |
| `workOrderRef` | Encargo que delimita el trabajo |
| `capabilities[]` | Lista cerrada; nada fuera de ella |
| `purpose` | Finalidad declarada del mandato |
| `budgetRef` | Presupuesto asociado (reserva, no promesa) |
| `issuedAt` / `expiresAt` | Vigencia |
| `revocationVersion` / `proofRef` | Revocación y prueba verificable |

Mandato vencido o revocado ⇒ se conserva estado e historia y **se bloquean efectos nuevos**. Un job en cola revalida principal, mandato, aprobación, versión, fuente, restricciones y presupuesto antes de actuar.

### AuthorityMap por WorkOrder

Solapamiento funcional con repos hermanos permitido; **un responsable por efecto y por campo**. Si dos flujos reclaman el mismo efecto externo, se bloquea/deduplica: no compiten con dos llamadas. Si falta un hermano, se declara bloqueo o se usa módulo local autorizado; nunca se inventa saldo, revisión o dictamen.

## 4. Superficie propuesta

- **API** prefijo `/v1/branding`: `GET /me`, `/resources`, `/resources/{id}`, `/integrations/{id}/capabilities`, `/jobs/{id}`, `/conflicts`, `/reports/{id}`; `POST /imports/preview`, `/imports`, `/proposals`, `/proposals/{id}/preview`, `/intents`, `/intents/{id}/reconcile`, `/reports`, `/advisor-sessions`, `/advisor-sessions/{id}/close`, `/privacy-requests`.
- **Prohibido**: `/provider/{method}`, SQL libre, HTTP/ORM/modelo de búsqueda arbitrario, `/execute-anything`, shell, eval, MCP genérico.
- **Capacidades nominadas** (contrato §3 de `docs/contracts/01-contratos.md`): `brand.brief.propose`, `brand.research.preview`, `brand.naming.propose`, `brand.clearance.preview`, `brand.voice.propose`, `brand.concept.preview`, `brand.rights.read`, `brand.font.preview`, `brand.document.update`, `brand.penpot.preview`, `brand.canvas.preview`, `brand.logo.propose`, `brand.palette.validate`, `brand.tokens.preview`, `brand.tokens.export`, `brand.template.propose`, `brand.layout.validate`, `brand.design.preview`, `brand.text.verify`, `brand.quality.evaluate`, `brand.brandbook.propose`, `brand.export.preview`, `brand.deliver.propose`, `brand.learning.propose`.
- **Tools expuestas al modelo (catálogo inicial)**: `brand_brief_read`, `brand_policy_read`, `brand_concept_propose`, `brand_design_preview`, `brand_rights_check`, `brand_export_preview`, `brand_review_read`. `tenant`/`actor`/scopes **no** son input libre. `approve`, `send`, `export_all`, `admin` fuera del catálogo.
- **SDK servidor**: TypeScript, proxy Hono con allowlist exacta de ruta/método/tamaño. Mismo PEP en API, SDK, MCP y Anam. Ningún paquete npm publicado por esta entrega.

Toda capability no verificada permanece `disabled` con estado `unknown`/`unsupported`/`forbidden` visible. Un `200` con HTML/estructura errónea o workspace equivocado no es «healthy».

## 5. Eventos y trazabilidad

Los eventos `branding.*` son **de este middleware**, no un enum vigente del padre:

`branding.proposal.created`, `branding.review.required`, `branding.resource.changed`, `branding.operation.confirmed`, `branding.operation.outcome_unknown`, `branding.connection.degraded`.

Campos: `id`, `schemaVersion`, `tenantId`, `actorRef`, `occurredAt`, `correlationId`, `causationId` y refs mínimas (no payloads sensibles).

**Proyección al padre** sólo para hechos confirmados, con `schemaVersion: "1.0"`, `owner`, `emittedAt`, `source.kind/id/personaId?` y `type` permitido. No se inventan kinds ni se notifica «hecho» sin receipt. Dedup durable por `domainEventId`; **ACK después del commit** del receptor. Un evento emitido no prueba recepción; `handoff` sin ACK no es trabajo completado.

## 6. Idempotencia, aprobación y efecto

- **Intent durable** por `tenant + capability + idempotencyKey` con `payloadHash`. Replay idéntico devuelve el resultado; misma key con otro payload ⇒ `409`.
- **Commit local atómico** de estado + versión + audit + idempotency + outbox. El HTTP remoto **no** comparte esa transacción.
- **Lease/fencing** protegen coherencia local; **no** dan exactly-once remoto.
- **Timeout tras posible aceptación** ⇒ reconciliar por referencia fiable; si no hay lookup, bloquear/escalar. Nunca reintentar con otra key o proveedor.
- **ApprovalBinding** liga: tenant, recurso, actor humano verificado, `payloadHash`/`resourceVersion`/`rightsHash`/`policyHash`, destinatario/canal, techo de coste, `expiry` y revocación. Un cambio material **invalida** la aprobación.
- El proponente no se aprueba a sí mismo ni amplía su payload/ámbito. Un revisor LLM puede **encontrar** problemas; no certifica ni aprueba su propio efecto.
- Preview local puro: no crea registro remoto, no envía, no firma, no contrata, no gasta.

## 7. Aislamiento de datos

JWT + membership + scope de recurso/campo, y además:

- FK compuestas por tenant, `RLS USING/WITH CHECK` y roles reales de API/worker (incluido revisar `BYPASSRLS`/`service_role`).
- Storage y URLs firmadas, Realtime, búsqueda/vectores, cachés, exports, reportes y backups con prefijo/namespace por tenant. Un namespace visual **no** es barrera.
- Cambiar de tenant en UI revalida y vacía contexto, jobs y sesión AV.
- Invitaciones/shares verificables, limitados, caducables y revocables; identidad de canal/email no se fusiona por nombre.
- Webhooks autenticados por firma/credencial/binding, no simulando JWT humano.
- Logs y métricas sin payload de cliente, sin PII y sin secretos. Telemetría ≠ ledger de evidencia.

## 8. Pruebas de integración previstas (todas `NOT_EXECUTED`)

Dos tenants sintéticos A/B y operador P, sin datos reales:

1. Principal A pide recurso/job/file/export de B ⇒ 0 fugas, intento auditado.
2. Colaborador del mismo tenant sin scope de materia/proyecto ⇒ 403.
3. `user_metadata` hostil con `tenant_id` ajeno ⇒ sin efecto.
4. Mandato vencido durante job en cola ⇒ no ejecuta, estado preservado.
5. Aprobación con `payloadHash` anterior tras edición ⇒ inválida, sin efecto.
6. Aceptación remota + crash antes de ACK ⇒ un efecto o incertidumbre bloqueada.
7. Replay de misma key ⇒ no duplica; distinta payload ⇒ 409.
8. SVG/XML con script, `on*`, `data:` o URL externa arbitraria ⇒ rechazo.
9. Activo sin licencia vigente ⇒ export bloqueado (`needs_rights_review`).
10. Restore tras supresión ⇒ no resucita datos ni permisos; no reenvía efectos.
11. Portal externo vs contrato integrado ⇒ misma policy.
12. Fuente del padre cambia ⇒ proyección `stale`, approval invalidada, sin overwrite del pasado.

Criterios críticos (un fallo detiene): 0 fuga tenant/recurso, 0 secretos centinela, 0 aprobaciones fabricadas, 0 duplicado de replay, 0 efecto sensible fuera de alcance.

## 9. Rollback y degradación

- Kill-switch por capacidad vía flags: detiene **efectos nuevos**, conserva audit/links/intents/snapshots/receipts.
- No se borran efectos remotos ni historia para «simular» reversión.
- DLQ con causa y decisión humana cuando el outcome es incierto; el cursor avanza tras commit.
- Migraciones aditivas y compatibles; si el rollback estructural no es seguro, se planifica explícitamente.
- Restore reaplica restricciones/supresiones y no reactiva mandatos caducados.

## 10. Cambios propuestos en el padre (documento, no ejecución)

Ninguno es necesario para el diseño; todos requieren otro encargo y autorización:

| # | Propuesta | Motivo | Estado |
|---|---|---|---|
| P1 | Confirmar `audience`/`issuer` exactos y política de rotación JWKS para servicios especialistas | Sin ellos C03 no puede verificar de forma fiable | `PENDING_FOUNDER` |
| P2 | Confirmar contrato de **provisioning de membership** por tenant | El servicio no puede deducir membership del JWT | `PENDING_FOUNDER` |
| P3 | Publicar la lista de `SystemEvent.type` aceptados y `source.kind` permitidos | Evita inventar enum host | `PENDING_FOUNDER` |
| P4 | Confirmar si existe puerto de **approvals/budget** reutilizable | Duplicar aprobaciones crearía doble autoridad | `PENDING_FOUNDER` |
| P5 | Confirmar resolución de **twin binding** por `runtimeId`/`roleId` | El twin no debe inventar `canonicalAgentId` | `PENDING_FOUNDER` |
| P6 | Definir el canal de bridge (endpoint, firma, mTLS o equivalente) | Hoy `HOST_BRIDGE_NOT_VERIFIED` | `PENDING_FOUNDER` |

Ninguna propuesta se implementa desde aquí. **No se modifica `agente`.**

## 11. Resumen de compatibilidad

| Dimensión | Estado |
|---|---|
| Identidad canónica en padre | Respetada por diseño; no se crea registro soberano |
| Twin local | Definido como delegado acotado, revocable, con propósito y presupuesto |
| JWT Supabase | Requisito transversal en todos los modos, incluido portal externo |
| Aislamiento multitenant | Extremo a extremo, con prueba cross-tenant como gate crítico |
| Eventos hacia el padre | Proyección de hechos confirmados, dedup durable, ACK posterior a commit |
| Efectos externos | Sólo con capability + mandato + approval vigentes; sin tools genéricas |
| Cambios en el padre | **Cero.** Seis propuestas documentadas, ninguna ejecutada |
| Verificación real | **Ninguna.** Bridge `HOST_BRIDGE_NOT_VERIFIED`; todo test es `NOT_EXECUTED` |
