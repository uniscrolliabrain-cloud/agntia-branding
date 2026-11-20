# agntia-branding

Branding, diseño y sistemas de marca: diseño de empresa SaaS especialista con middleware hacia AgntiaPro/`agente`. Entrega documental de la familia Agntia · 2026-11-13.

**IMPLEMENTACIÓN PARCIAL Y LOCAL. Hay código TypeScript ejecutable, typecheck limpio y 108 tests reales en verde, incluida la RLS probada contra un PostgreSQL 18 efímero y el render de PDF/PNG/SVG con hash de bytes; no hay proveedores conectados, ni entorno gestionado, ni despliegue.** Las 42 campañas originales siguen intactas en el manifest; su estado de implementación real vive en [la matriz de estado](docs/implementation/STATUS.md) (30 implementadas en local, 10 parciales, 1 bloqueada por proveedor, 1 sin implementar; 75/84 gates PASS sobre reglas locales). Aspiración de calidad inspirada en referentes mundiales; no afirmación de paridad, certificación o cumplimiento universal.

Entregar identidad y materiales de marca editables, coherentes, accesibles y trazables con revisión humana y derechos de uso demostrables.

Se presta servicio a empresas del padre y a clientes externos mediante portal propio. Agentes canónicos en `/agente`, twins vinculados aquí; todos los modos con JWT Supabase, membresía/ACL verificados y aislamiento de datos/jobs/archivos/búsqueda/Realtime/exportaciones. Se permite duplicación de funciones con repos hermanos; un AuthorityMap por encargo fija responsables para evitar doble efecto. **No se modifica agente.**

## Implementación

`src/` con contratos Zod, autenticación JWT, PEP, aprobaciones, idempotencia, outbox, dominio de marca (brief, naming, derechos, tipografía, documento vectorial, tokens, QA, preflight, handoff) y API `/v1/branding`. `src/db/schema.sql` define 18 tablas con RLS y FK compuestas por tenant. `test/` contiene la suite (88 casos).

```bash
npm ci && npm run typecheck && npm test && node scripts/check-invariants.ts
```

Ningún adaptador externo (Penpot, Anam, gateway de modelos, Supabase) está configurado: se declaran `not_configured` y no se simulan. Sin `DATABASE_URL`, `migrate`/`seed` salen con `NOT_CONFIGURED`.

`src/domain/render.ts` produce los bytes: PDF 1.4 con xref real, PNG con IHDR/IDAT/zlib y SVG, todo sin dependencias y determinista byte a byte. Cuando el render sustituye algo que el manifiesto prometía (Helvetica en el PDF, bitmap 5x7 en el PNG) devuelve un *finding* y **no emite el archivo** hasta que el llamante lo acepta de forma explícita.

`test/db-rls.test.ts` levanta un PostgreSQL efímero, aplica `schema.sql` y `seed.sql` y demuestra el aislamiento A/B con `app_api` y `app_worker`, incluido el rechazo de escritura cruzada y el fail-closed sin tenant en sesión. En CI corre en un job propio con `REQUIRE_DB=1`, de modo que un salto silencioso falla.

## Leer en orden

1. [Producto y capacidades](docs/01-producto.md), [investigación](docs/02-investigacion.md), [comparación](docs/03-referentes-y-brechas.md), [repos/licencias](docs/04-adaptadores.md).
2. [Arquitectura](docs/architecture/01-arquitectura.md), [Supabase/twins](docs/architecture/02-identidad-twins.md), [padre](docs/architecture/03-compatibilidad-agente.md), [runtime](docs/architecture/04-runtime.md), [contratos](docs/contracts/01-contratos.md).
3. [Seguridad](docs/05-seguridad-privacidad.md), [UX/Anam](docs/06-ux-anam.md), [SaaS/cooperación](docs/07-servicio.md), [coste](docs/08-costes.md), [evaluación](docs/09-evaluacion.md).
4. [42 campañas](docs/campaigns/README.md), [manifest](docs/campaigns/campaign.json), [handoff](docs/release/HANDOFF.md), [informe](docs/release/INFORME-AL-OWNER.md), [aceptación](docs/release/PILOT-ACCEPTANCE.md), [runbook](docs/operations/RUNBOOK.md).

Vertical propuesta: Brief sintético → investigación autorizada → conceptos → identidad verbal/visual → tokens → diseño editable → QA/rights → revisión humana → export sandbox → brandbook/hash.

Límite inicial: Sin registrar marca, prometer disponibilidad jurídica, copiar identidad de terceros, publicar/desplegar sin permiso, eliminar originales o usar fuentes/assets sin licencia. Generación IA es propuesta y no certifica autoría/exclusividad.

Fuentes primarias y repos por SHA: [sources](docs/research/sources.json), [repos](docs/research/repositories.json), [mapa padre](docs/research/parent-source-map.json). [Validación](docs/release/document-validation.json) comprueba documentos, no acredita producto. SHA del padre cotejado: `54b8d5407a8576459448c4d059a877297d18ca7a`.
