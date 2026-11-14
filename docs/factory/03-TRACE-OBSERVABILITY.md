# ADTC — Identidad, causalidad y observabilidad de Branding

**Contrato conceptual v0.1, no desplegado.** Padre mantiene bus/grafo/runtime canónicos; Ciberseguridad será observador transversal de todos los repositorios y de cada tenant, sin bloquear la ruta de negocio.

## Envelope propuesto
```json
{"schemaVersion":"adtc/0.1","eventId":"new-event-id","eventType":"branding.asset.approved","tenantId":"verified-tenant","actorId":"verified-actor","taskId":"task-ref","correlationId":"stable-workflow-id","causationId":"prior-event-id","requestId":"ingress-ref","traceId":"w3c-trace-id","spanId":"current-span-id","idempotencyKey":"effect-specific-key","source":"agntia-branding","resourceRefs":["brand-asset-ref"],"evidenceRefs":["rights-ref","approval-ref"],"payloadRef":"access-controlled-ref"}
```
No afirmar que este JSON sea `SystemEvent` nativo; mapping explícito y versionado al contrato real.

## Reglas
Propagar tenant/correlation/mandato, crear eventId por evento, causationId por relación, spanId por operación técnica; traceId puede variar entre sesiones sin perder correlación. Para derivados de activos conservar `sourceAssetId`, `revisionId`, `licenseRef`, `approvalRef`, `exportManifestId` y hashes donde correspondan. No copiar binarios, fuentes licenciadas ni briefs sensibles a todo el bus: referencias con ACL y retención. Multi-tenant de extremo a extremo (archivos, previews, cachés, renders, workers, RAG, logs, dashboards, export). Outbox, inbox dedupe, retries acotados, dead-letter, outcome_unknown, auditoría durable append-only; OpenTelemetry es telemetría, no ledger de evidencia.

## Reconstrucción ejemplo
Cliente aprueba brief → Branding crea concepto → revisa derechos → aprueba tokens/brandbook → Diseño o Marketing recibe paquete versionado → Redes publica tras autorización → proveedor devuelve receipt → bus padre recibe evento de resultado → Ciberseguridad puede reconstruir cadena por IDs. Cada efecto externo tiene dueño, intent y idempotencia propios.

## Casos de diseño negativos
Tenant B no puede leer previews/activos/logs A; revocar licencia bloquea export no autorizado; fallo de render no se declara entrega; caída del observador no detiene outbox de negocio; replay no publica de nuevo; cambio de documento tras aprobación invalida approval; colisión de idempotencyKey con payload diferente falla.
