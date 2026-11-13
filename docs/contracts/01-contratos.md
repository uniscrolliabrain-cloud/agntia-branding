# Contratos de diseño v1

Propuesta, no API/SDK existente. TypeScript+validación runtime/JSON Schema, extra fields rechazados, límites de tamaño, IDs opacos y enums cerrados. Dinero Decimal string/currency/exponente, fechas ISO con offset y timezone separada. No forzar UUID a IDs del padre o usar float para compromisos monetarios. schemaVersion del servicio es distinto del SystemEvent nativo string1.0.

## Envelope propuesto

```json
{"schemaVersion":1,"operationId":"opaque","tenantId":"server-resolved","actorId":"server-verified","capability":"branding.proposal.preview","requestId":"host-if-present","correlationId":"trace","causationId":null,"idempotencyKey":"domain-key","expectedVersion":3,"approvalRef":null,"dryRun":true,"payload":{"resourceId":"opaque"}}
```

Identity/capability del JSON no son prueba; principal/policy las derivan/verifican. Envelope.tenantId es scope de datos, no sustitución del Actor de origen al delegar. Worker con identidad de servicio y DelegationMandate: originatingActor/tenant, targetTenant, WorkOrder/TwinBinding, recursos/campos/capabilities/purpose, budget, issued/expires/revocationVersion/proof. Sin membership implícita o redelegación ampliada.

## Entidades y datos específicos

| Módulo | Campos/refs propuestos | Capacidad nominada interna/propuesta |
|---|---|---|
| Brief y estrategia | purpose, audienceDeclared, deliverables, constraints, acceptance | brand.brief.propose |
| Investigación de marca | sourceRef, observedAt, usageRights, inferenceLabel | brand.research.preview |
| Naming y opciones | nameCandidate, locale, rationale, uncertainty | brand.naming.propose |
| Clearance preliminar | registrySource, territory, classScope, checkedAt, reviewer | brand.clearance.preview |
| Identidad verbal | tone, lexicon, claims, localeRules, examples | brand.voice.propose |
| Direcciones visuales | conceptRef, moodSources, rightsRefs, designRationale | brand.concept.preview |
| Ledger de activos y derechos | assetHash, source, licenseRef, releaseRef, expiresAt | brand.rights.read |
| Tipografía y fuentes | fontHash, familyLicense, embeddingRights, fallbackPolicy | brand.font.preview |
| Documento vectorial | documentId, nodes, constraints, version, textSources | brand.document.update |
| Adaptador Penpot | teamProjectBinding, fileRevision, role, capabilities | brand.penpot.preview |
| Canvas Fabric/SVG | nodeSchema, safeAttributes, imageRefs, renderVersion | brand.canvas.preview |
| Logotipo y variantes | logoRevision, geometry, text, minSize, variants | brand.logo.propose |
| Paleta y accesibilidad | colorSpace, roles, contrastPairs, targetStandard | brand.palette.validate |
| Design tokens | tokenPaths, types, aliases, version, theme | brand.tokens.preview |
| Style Dictionary | inputHash, transformAllowlist, targetFormat, engineVersion | brand.tokens.export |
| Plantillas y componentes | templateRevision, slots, protectedNodes, locale | brand.template.propose |
| Layouts responsive | breakpoints, constraints, readingOrder, overflow | brand.layout.validate |
| Composición y edición | operationKey, nodeDiff, expectedVersion, reversiblePatch | brand.design.preview |
| QA de texto | sourceTextHash, OCRComparison, typographyConstraints | brand.text.verify |
| QA visual y revisión | geometryChecks, perceptionModel, findings, humanDecision | brand.quality.evaluate |
| Brandbook y reglas | policyVersion, doDont, sourceRefs, approvedAssets | brand.brandbook.propose |
| Export y preflight | editableHash, renderHash, DPI, colorProfile, exportManifest | brand.export.preview |
| Entrega y publicación | deliverableRef, receiverScope, acceptanceRef, receipt | brand.deliver.propose |
| Aprendizaje y librería | procedureProposal, evidence, replayGate, tenantScope | brand.learning.propose |

Estas entidades no son aliases automáticos de modelos del proveedor/padre. Tipos públicos contienen refs mínimos/estado/frescura; secretos y documentos restringidos se custodian por backend con permiso. Estado desconocido, dato no verificado, bloqueado y no soportado son valores explícitos, nunca null ambiguo rellenado por LLM.

## DTOs transversales

EvidenceRef: id, tenantId/resourceScope, originalCustodian, sourceObjectRef/hash, mapperVersion, observed/effectiveAt, kind fact/inference/user_assertion/observation y reviewRef. Cuando proyecte provenance nativa, preservar source/actor/updatedAt/confidence? sin convertir confianza en permiso. ExternalLink: tenant/connection/provider/model/externalId string/localKind/localId, remoteVersion, sourceHash y lastSeenAt.

ProposalRevision: resource/version, structuredInputs, artifacts, sources, pendingFacts, scopeHash, modelConfigRef, policyVersion y warnings. ApprovalBinding: principal/reviewer competente según caso, proofRef, payloadHash/resourceVersion/rightsHash/policyHash, tenant/recipient/channel/costCeiling/expiry/revocation. OperationResult discriminado: status/localRefs/remoteRefs/evidenceRefs/payloadHash/warnings/retryable/reconciliationRequired/actualScope. Nunca payload remoto sensible completo.

CapabilityReport: deployment/edition/version, operaciones/campos/ACL confirmados, timestamp/expiry/errors y evidence. SyncJob/Cursor/Conflict/ReportSnapshot: ámbito tenant/recurso, estado/versión/correlación/sourceWatermark/coverage/hash y resolución revisable. Índices únicos por tenant/capability/key, tenant/connection/model/externalId/localKind y tenant/connection/externalEventId; FK compuestas por tenant para cardinalidades explícitas.

## API nominada prevista

Prefijo `/v1/branding`. GET /me, /resources, /resources/{id}, /integrations/{id}/capabilities, /jobs/{id}, /conflicts y /reports/{id}. POST /imports/preview y /imports; /proposals y /proposals/{id}/preview; /intents; /intents/{id}/reconcile; /reports; /advisor-sessions y /advisor-sessions/{id}/close; /privacy-requests. Acciones específicas anteriores se materializan solo si son capacidades de producto autorizadas, no baseline/admin endpoints por defecto.

Lecturas con fields/filters allowlist, paginación y ACL antes de acceso. Commits con key/expectedVersion/approval según riesgo y revalidación. Trabajo largo202+jobId scoped. Dry-run no muta; test endpoint remoto puede tener efecto y requiere su propia autorización. No /provider/{method}, SQL libre, HTTP/ORM/model/domain de búsqueda arbitrario o /execute-anything.

Errores400/422 input/negocio;401auth;403capacidad;404recurso ajeno/inexistente;409versión/key/conflicto;424dependencia si se adopta;429límite;502respuesta inválida;503proveedor;504timeout. Envelope code/message/correlationId/retryable/reconciliationRequired sin traceback/PII/secretos. Resultado incierto no es failed seguro para retry.

## Tools, eventos y compatibilidad

Tools propuestas: `brand_brief_read brand_policy_read brand_concept_propose brand_design_preview brand_rights_check brand_export_preview brand_review_read`. Tenant/actor/scopes no son input libre del modelo. Approve/send/export_all/admin y efectos sensibles fuera del catálogo inicial. SDK servidor privado y proxy Hono con allowlist exacta de ruta/método/tamaño; MCP/Anam usan mismo PEP. No anunciar paquete npm/pip publicado por este documento.

Eventos nuevos `branding.proposal.created`, `.review.required`, `.resource.changed`, `.operation.confirmed`, `.operation.outcome_unknown`, `.connection.degraded` con id/schemaVersion/tenant/actorRef/occurredAt/correlation/causation y refs mínimas. No enum host inventado; bridge mapea hechos confirmados al SystemEvent nativo con owner/emittedAt/source permitido. Outbox/inbox/receipt dan entrega at-least-once y ACK posterior al commit, no garantía de exactly-once HTTP.
