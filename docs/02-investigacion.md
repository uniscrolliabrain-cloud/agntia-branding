# Investigación y decisiones

Fuentes primarias consultadas selectivamente 2026-11-13; no revisión sistemática ni benchmarks reproducidos. El registro separa abstract/README/documentación/anuncio, acceso fallido y validación de runtime. Revalidar al implementar porque versiones, planes y leyes pueden cambiar.

| Paper | Decisión de diseño (inferencia propia) |
|---|---|
| P01: Graphic-Design-Bench · [arXiv](https://arxiv.org/abs/2604.04192) | Medir layout, tipografía, texto, vector y semántica por separado; una imagen atractiva no acredita archivo estructurado válido. |
| P02: Designer-RSI · [arXiv](https://arxiv.org/abs/2609.22086) | Memoria procedimental con gate de replay inspira propuestas de SOP; no aprender automáticamente de tráfico privado de clientes. |
| P03: GraphicBench · [arXiv](https://arxiv.org/abs/2504.11571) | Planificación y ejecución creativa tienen errores distintos; probar dependencias globales y artefactos finales, no solo el plan. |

No se trasladan scores, porcentajes, tamaños de muestra o eficacia de los autores a Agntia. Leer un abstract no demuestra replicación de método o licencia de sus datasets. Se diseñarán fixtures originales con datos sintéticos y criterios de estado/efecto/proceso; antes de incorporar harness/datos ajenos revisar licencia, splits, dependencia de modelos y términos.

## Conceptos propuestos

Evidence-to-Effect Ledger une fuente, versión, actor, mandato, propuesta, approval y resultado confirmado. Scope-bound Twin conserva una identidad canónica y especialización local por cliente sin memoria global. Reviewable Decision Contract define hechos, estado protegido, resultado y qué requiere humano/competencia. Son propuestas de ingeniería de esta entrega, no afirmación de novedad científica o patente.

Para Branding, diseño y sistemas de marca, la decisión particular es: DesignDocument con nodos/constraints/versiones y fuentes de texto; render determinista por engine/version/font hash. QA geométrica y de texto, contraste calculado donde aplicable, diff de documento y pixel diff con tolerancia declarada. Font fallback no silencioso. ExportManifest liga editable, recursos, licencias y renders.

## Referentes actuales

| Referencia | Patrón estudiado |
|---|---|
| V01: Figma design agent | Estudiar edición/constraints y revisión colaborativa; no presumir que API REST permite cualquier edición. |
| V02: Canva | Patrón de plantillas y consistencia; términos/planes/rights se revisan por función. |
| V03: Adobe AEM Assets | Patrón DAM y gobernanza de activos; no heredar licencias o certificaciones de su página. |

Las páginas oficiales describen oferta y novedades, no se probaron productos ni cuentas. No adoptar sus claims de cumplimiento, seguridad, productividad o certificaciones como propios. API/plan/edición/territorio y coste son gates de implementación. Fuentes no accesibles se registran, no sustituyen con una afirmación de capacidad. Algunas URLs cambian de ruta o versión: conservar el origen/redirect y no fijar un endpoint por memoria.

## Repos públicos

Se consultaron metadatos, SHA y README de los candidatos de [repositories.json](research/repositories.json). No son una auditoría completa ni se han instalado. Rama main/master/develop/hotfix no es un pin de release. Selección posterior por compatibilidad/licencia/recursos/ACL y evidencia con una instancia aislada. Penpot MPL-2.0 y Fabric/SVG-Edit MIT son candidatos según metadatos; revisar dependencias. Style Dictionary Apache-2.0 no certifica licencia de cada token/asset. Google Fonts requiere leer la licencia de cada familia, embedding/subsetting y condiciones de redistribución; no todo contenido del repo recibe una licencia única.

## Fuentes jurídicas y de seguridad

Supabase JWT/RLS y Anam se estudiaron en documentación oficial; nunca credenciales ni sesiones reales. Normativa común y específica en Dxx requiere interpretación contextual, territorio/fecha y revisión humana. No prometer cumplimiento universal por importar una librería o tener un dashboard. Un uso no cubierto debe quedar unsupported/needs_review.

| Fuente específica | Qué exige al diseño |
|---|---|
| D01: [Propiedad intelectual](https://www.boe.es/buscar/act.php?id=BOE-A-1996-8930) | Derechos, licencias y usos necesitan análisis concreto; procedencia no equivale a autorización. |
| D02: [Marcas](https://www.boe.es/buscar/act.php?id=BOE-A-2001-23093) | Búsqueda preliminar no prueba registrabilidad/disponibilidad ni sustituye evaluación jurídica. |

Mantener preguntas abiertas: derechos/ediciones, fuente incompleta, verificación real de proveedor, operación humana y coste medido. El mapa del padre conserva lecturas heredadas y nuevas por el mismo SHA; no supone una relectura total. Cualquier divergencia futura se coteja antes del wiring. Nunca modificar el padre para que una prueba propia pase.
