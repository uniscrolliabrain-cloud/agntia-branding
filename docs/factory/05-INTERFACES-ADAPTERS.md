# Contratos de cooperación y adapters — Branding

## Autoridad por efecto
Duplicación de habilidades entre padre y especialista está permitida. Una acción externa (publicar, registrar, comprar, modificar CRM, desplegar, enviar) requiere actor/tenant/mandato/approval y ejecutor único. Los agentes especialistas son profesionales contratables, no empleados full-time de cada cliente. Anam, teléfono, WhatsApp y chat son canales, no permisos.

## Matriz de cooperación
- **AgntiaPro padre:** identidad canónica, kernel, bus, grafo, SOPs, aprobaciones, policy, memoria.
- **Branding:** estrategia/identidad/brandbook/activos y derechos.
- **Diseño futuro:** diseño gráfico y web, vibe coding, Lovable/Vercel según APIs disponibles y autorización; Branding aporta tokens y guías, no se atribuye deploy.
- **Marketing/Redes:** campañas, contenido social, distribución con uso de activos aprobados.
- **Vídeo:** producción audiovisual y generación/edición por lenguaje natural, respetando marca/licencias.
- **Clientes/Ventas:** CRM, briefing, propuestas y oportunidades.
- **Legal:** propiedad intelectual, marcas, contratos y cumplimiento; clearance preliminar no es asesoría concluyente.
- **Ciberseguridad:** seguridad y observabilidad transversal; acceso limitado por tenant/propósito.

## Puertos propuestos
`BrandResearchPort`, `DesignDocumentPort`, `VectorEditorPort`, `AssetStoragePort`, `RightsRegistryPort`, `BrandExportPort`, `PublicationHandoffPort`, `AuditEvidencePort`. Integraciones posibles según validación: Penpot, SVG/Fabric, Style Dictionary, librerías de activos, Drive, Airtable, CRM, APIs y MCP autorizados. No asumir licencias o disponibilidad de endpoints.

## Adapter declaration
`provider`, `capability`, `tenantBinding`, `resourceScope`, `permissions`, `rights`, `sourceOfTruth`, `dataResidency`, `rateLimit`, `budget`, `timeout`, `retryPolicy`, `idempotency`, `reconciliation`, `circuitBreaker`, `audit`, `schemaVersion`. Los adapters son sustituibles sin alterar semántica de negocio. MCP no elude políticas. Si un cliente ya usa herramientas propias, integrar por adaptador sin forzar migración.
