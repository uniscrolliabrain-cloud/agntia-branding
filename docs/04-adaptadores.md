# Adaptadores y licencias

Todos NOT_IMPLEMENTED/NOT_VERIFIED en runtime. [Repos por SHA](research/repositories.json); lectura de metadatos/README y licencias selectivas, no auditoría completa. No se han clonado/instalado ni usado cuentas demo ajenas. La elección de release/digest estable queda pendiente.

| ID | Repositorio | Licencia metadata | Uso/precaución |
|---|---|---|---|
| R01 | [penpot/penpot](https://github.com/penpot/penpot/tree/d774e197d0435422bcfd3cac3064622ea79396d3) | MPL-2.0 | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |
| R02 | [fabricjs/fabric.js](https://github.com/fabricjs/fabric.js/tree/ab604137e04dd7d3d566462a6b27f5863e37c60b) | MIT | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |
| R03 | [SVG-Edit/svgedit](https://github.com/SVG-Edit/svgedit/tree/c44f061d2f9a626d2771cc931298af5a45522d87) | MIT | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |
| R04 | [style-dictionary/style-dictionary](https://github.com/style-dictionary/style-dictionary/tree/795233d9bee6a7b5787d685d75d626df3399d24d) | Apache-2.0 | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |
| R05 | [google/fonts](https://github.com/google/fonts/tree/3e5667764ccfea32ce0c3d58a3a4756de890adc1) | UNKNOWN | Candidato de dominio o referencia; capacidades/edición/ACL se verifican por instalación |

Penpot MPL-2.0 y Fabric/SVG-Edit MIT son candidatos según metadatos; revisar dependencias. Style Dictionary Apache-2.0 no certifica licencia de cada token/asset. Google Fonts requiere leer la licencia de cada familia, embedding/subsetting y condiciones de redistribución; no todo contenido del repo recibe una licencia única.

La licencia de código no cubre automáticamente pesos/modelos, contenido de cursos, tipografías, plantillas, corpus judiciales, datos actuariales, plugins o servicios cloud. No copiar upstream por comodidad. API/proceso separado es arquitectura recomendada, no excepción jurídica universal. Leer obligaciones de modificación/distribución/servicio en red y compatibilidad antes de incorporar material.

## Registro y discovery

ProviderConnection por tenant/proyecto, endpointRef/secretRef solo servidor, versión/edición y binding remoto. No aceptar URL, base de datos, company/site/course/workspace, token o método libre desde un modelo. Bot mínimo por ámbito, rotación sin perder links y secretos externos. DNS/IP/redirect/tamaño/tiempo/egress protegidos. Public JSON minimizado, no credenciales/nombres internos innecesarios.

CapabilityReport distingue documented, verified_runtime, unknown, unsupported, forbidden y not_configured, con fecha/expiry/evidencia. Un200 con HTML/estructura errónea o empresa equivocada no es healthy. Sin permiso no se cae a admin; no crear registros reales para probar discovery. Unknown deshabilitado y advertencia útil. Cada versión/edición/modulo/rol puede invalidar el report.

## Lectura, staging y sincronización

ExternalLink por tenant/connection/model/externalId/localKind, IDs strings opacos, sourceHash/remoteVersion/mapperVersion. No mapear por nombre o posición. Import preview conserva warnings/campos pendientes/procedencia; aceptación local no fabrica revisión profesional, consentimiento o emisión remota. Repetición idéntica no duplica; cambio legítimo crea nueva revisión/conflicto según AuthorityMap.

Cursores/paginación estables con overlap si hace falta; watermark después de commit local. Barridos detectan archivado/borrado remoto sin destruir historia. Conflicto con dato revisado bloquea overwrite. Dos sistemas que reclaman autoridad por mismo campo/efecto deben acordarlo antes de bidireccionalidad, no last-write-wins silencioso.

## Escritura

Dry-run puro local; preview con diff/alcance/coste y aprobación cuando corresponda. Algunos endpoints llamados test envían o modifican estado: demostrar semántica antes de usarlos. Persistir intent/audit/key/outbox antes de HTTP; cada llamada remota tiene su transacción propia. Si el proveedor acepta y se pierde respuesta, reconciliar por referencia segura; si no existe, bloquear/escalar, no duplicar con otra key/proveedor. No delete/unlink/submit/post/execute genéricos al agente.

El piloto conserva este límite: Sin registrar marca, prometer disponibilidad jurídica, copiar identidad de terceros, publicar/desplegar sin permiso, eliminar originales o usar fuentes/assets sin licencia. Generación IA es propuesta y no certifica autoría/exclusividad. Un backend faltante queda explícito; un fake útil no se ofrece como conector real. La UI del proveedor puede existir para administración interna, sin ser interfaz obligatoria del cliente. Feature flags detienen nuevas operaciones sin borrar evidencia/links ni simular rollback de efectos externos.
