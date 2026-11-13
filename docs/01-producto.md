# Producto, capacidades y límites

## Resultado para el cliente

Entregar identidad y materiales de marca editables, coherentes, accesibles y trazables con revisión humana y derechos de uso demostrables. El cliente contrata una especialidad con entregables revisables, no una simulación de personas trabajando. El avatar explica datos, fuentes, límites y bloqueos; el owner puede editar propuestas y aprobar el resultado concreto. Humanos y agentes generalistas usan el mismo servicio bajo permisos. Un cliente externo tiene portal propio y Supabase; no debe entrar en AgntiaPro o paneles ERP/LMS/CRM para obtener valor.

| Pilar | Valor previsto | Prueba exigida |
|---|---|---|
| Investigación y estrategia de marca con fuentes | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Naming y comprobación preliminar de disponibilidad | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Identidad verbal/visual y sistemas de tokens | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Editor vectorial, plantillas y diseño responsive | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| QA visual, tipográfica y accesibilidad | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |
| Asset ledger, brandbook y entrega versionada | Trabajo específico con datos/objetivos del encargo | Fuentes, revisión, ACL, versión y receipt/artefacto verificables |

Estas capacidades son diseño, no features implementadas. Las 24 fases de dominio detallan objetos, invariantes y escenarios; se complementan con ocho fundaciones y diez fases de exposición/seguridad/operaciones hasta completar42. No instalar todos los backends para aparentar cobertura. Elegir un camino P0 funcional, conservar capacidades opcionales deshabilitadas hasta prueba real.

## Actores y datos

Organización operadora emplea al agente canónico del padre; tenant representa empresa cliente del SaaS; proyectos/materias/cohortes/cuentas son recursos internos; personas registradas en datos no se convierten en usuarios autorizados por importarlas. Usuario válido no ve todo el tenant: ACL por recurso/campo, representación y propósito cuando corresponde. Un mismo humano puede trabajar en varios tenants y debe seleccionar ámbito verificado explícitamente.

Entidades propuestas: `BrandBrief ResearchSource NameCandidate ClearanceCheck BrandPolicy DesignDocument DesignNode FontLicense AssetRights TokenSet Template Variant ReviewDecision ExportManifest BrandbookSnapshot`. Sus IDs son del servicio salvo mapeo nativo declarado. Owner aprueba estrategia/diseño; el ledger conserva origen/rights; el documento estructurado es editable canónico del servicio o backend elegido; el render es una proyección verificable. La fuente remota y el snapshot local tienen autoridad/frescura distintas. El modelo no rellena campos desconocidos para completar una pantalla; faltan datos significa pending/blocked, no falso éxito.

## Vertical inicial

Brief sintético → investigación autorizada → conceptos → identidad verbal/visual → tokens → diseño editable → QA/rights → revisión humana → export sandbox → brandbook/hash.

Usar empresas/personas/documentos sintéticos y sink/entorno de prueba, con dos tenants y operador separado. Un borrador no es acto externo ni una certificación. Cualquier conector que falte se indica NOT_VERIFIED, sin presentar mock como instalación real. El piloto puede entregar conocimiento y propuesta útil aunque un efecto sensible quede deliberadamente fuera.

## Límites de efecto

Sin registrar marca, prometer disponibilidad jurídica, copiar identidad de terceros, publicar/desplegar sin permiso, eliminar originales o usar fuentes/assets sin licencia. Generación IA es propuesta y no certifica autoría/exclusividad.

El valor visual no compensa violación de derechos, texto inexacto, SVG ejecutable o pérdida del editable. Las revisiones son actos humanos verificables ligados al payload y versión. No las fabrica un nombre de agente, un sí hablado o un campo approved=true. La aceptación comercial del servicio, el acceso a datos, la revisión editorial y la autorización de efecto son hechos distintos.

## Cooperación y evolución

Se admite duplicación funcional entre los nueve SaaS y el padre. ServiceAgreement/WorkOrder fija alcance, responsable y sistema ejecutor por efecto. Un módulo local acotado puede cubrir una función sin contratar un hermano, pero no inventa autorización profesional, saldo, dictamen o evidencia. Integrar no significa compartir todos los datos: contratos mínimos, propósito, ACK y trazabilidad.

La expansión exige nuevos permisos, pruebas y contratos cuando se habiliten datos reales, proveedores pagados o funciones reguladas. La campaña no garantiza paridad con líderes, precisión universal o disponibilidad jurídica de cada función. Producto completo significa capacidades verificadas en ámbito concreto con operación/recuperación y límites visibles, no una lista de logos.
