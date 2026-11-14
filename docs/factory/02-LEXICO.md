# Léxico compartido — AgntiaPro / Branding

**v0.1 conceptual, contratos a cotejar con padre por SHA.**

## Identidad y trabajo
`tenantId` = empresa/ámbito de datos; `owner` = scope legado en parte del padre, no sinónimo; `actorId` = actor autenticado/autorizado, no `sub` JWT ni `personaId`; `HumanActor` y `AgentActor` = tipos del padre; `runtimeId`, `roleId`, `personaId` = identidad/rol/persona con significados distintos. `TwinBinding` = vínculo propuesto con especialista; no segundo registro soberano. `Task` ≠ `SOP` ≠ `ActionProposal` ≠ `Approval` ≠ `Event`. `AuthorityMap` = autoridad propuesta por efecto y recurso; `DelegationMandate` = mandato limitado propuesto.

## Causalidad y evidencias
`correlationId` identifica workflow completo; `causationId` enlaza evento causante; `eventId` nuevo por evento; `traceId`/`spanId` para telemetría técnica; `requestId` no sustituye correlationId; `idempotencyKey` deduplica un efecto, no una conversación; `schemaVersion` es del contrato específico. `outcome_unknown` requiere reconciliación. `EvidenceRef`, `SourceRef`, `SourceHash`, `EffectReceipt` preservan procedencia, no otorgan autorización. Las aprobaciones nativas del padre no se renombran sin verificar.

## Branding (entidades PROPOSED)
`BrandBrief` = mandato y requisitos aprobables; `ResearchSource` = fuente y derechos; `NameCandidate` = candidato, no nombre legalmente libre; `ClearanceCheck` = comprobación preliminar, no registro de marca; `BrandPolicy` = reglas de identidad; `DesignDocument`/`DesignNode` = fuente editable versionada; `AssetRights`/`FontLicense` = derechos y límites de uso; `TokenSet` = tokens de diseño; `Template`/`Variant` = derivaciones; `ReviewDecision` = aprobación versionada; `ExportManifest` = paquete verificable; `BrandbookSnapshot` = guía de marca a versión fija.

`BrandIdentity` ≠ `BrandAsset` ≠ `CampaignCreative` ≠ `WebDesign`. Branding define sistema de marca; Diseño futuro produce piezas gráficas/web bajo ese sistema; Marketing usa activos aprobados en campañas; Redes distribuye; Vídeo adapta audiovisualmente. Solapamiento permitido, autoridad del efecto declarada.

## Invariantes
Naming no equivale clearance jurídico; logo generado no implica exclusividad ni titularidad garantizada; preview no equivale archivo editable; export no equivale publicación; color bonito no garantiza contraste; licencia de fuente no equivale permiso de redistribución; approval liga hash/version/alcance. IDs opacos; versiones explícitas; provenance y hashes; DTOs estrictos en frontera. Estado de estos conceptos: DOCUMENTED/PROPOSED hasta verificación posterior.
