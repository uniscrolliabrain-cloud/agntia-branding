# Matriz de estado de implementación

Generado 2026-11-20T14:56:38.332Z sobre `deb6e59400fea8f07ece16613be90b2145ec00be`. Fuente de verdad legible por máquina:
[`implementation-status.json`](implementation-status.json).

**No sustituye al programa.** `docs/campaigns/campaign.json` sigue siendo el plan
original (42 campañas, 294 tareas, 84 gates) y no se ha reescrito. Este documento
dice qué parte de ese plan tiene código ejecutable hoy.

## Resumen

| Estado | Campañas |
|---|---|
| IMPLEMENTED_LOCAL (regla implementada y con test local) | 30 |
| PARTIAL (núcleo local; falta proveedor, canal o UI) | 10 |
| BLOCKED_PROVIDER (requiere backend externo) | 1 |
| NOT_IMPLEMENTED (sin código) | 1 |

Gates: **75/84 PASS**, **9/84 NOT_VERIFIED**.

Verificado en este commit: `tsc --noEmit` 0 errores · `node --test test/` 108/108 ·
`node scripts/check-invariants.ts` 7/7 · `npm run test:db` 7/7 contra PostgreSQL real.

## Detalle

| Campaña | Título | Estado | G01 | G02 | Evidencia |
|---|---|---|---|---|---|
| BRD-C01 | Baseline, fuentes y alcance | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c01/README.md) |
| BRD-C02 | Autoridad por dominio y contrato SaaS | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c02/README.md) |
| BRD-C03 | Supabase JWT y principal | PARTIAL | PASS | PASS | [evidencia](docs/implementation/c03/README.md) |
| BRD-C04 | Twins y nomenclatura canónica | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c04/README.md) |
| BRD-C05 | DTOs, esquemas y errores | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c05/README.md) |
| BRD-C06 | Persistencia, RLS y migraciones | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c06/README.md) |
| BRD-C07 | Mandatos, finalidad y aprobaciones | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c07/README.md) |
| BRD-C08 | Secretos, discovery y aislamiento remoto | PARTIAL | PASS | PASS | [evidencia](docs/implementation/c08/README.md) |
| BRD-C09 | Brief y estrategia | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c09/README.md) |
| BRD-C10 | Investigación de marca | PARTIAL | NOT_VERIFIED | PASS | [evidencia](docs/implementation/c10/README.md) |
| BRD-C11 | Naming y opciones | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c11/README.md) |
| BRD-C12 | Clearance preliminar | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | [evidencia](docs/implementation/c12/README.md) |
| BRD-C13 | Identidad verbal | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c13/README.md) |
| BRD-C14 | Direcciones visuales | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c14/README.md) |
| BRD-C15 | Ledger de activos y derechos | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c15/README.md) |
| BRD-C16 | Tipografía y fuentes | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c16/README.md) |
| BRD-C17 | Documento vectorial | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c17/README.md) |
| BRD-C18 | Adaptador Penpot | BLOCKED_PROVIDER | NOT_VERIFIED | NOT_VERIFIED | [evidencia](docs/implementation/c18/README.md) |
| BRD-C19 | Canvas Fabric/SVG | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c19/README.md) |
| BRD-C20 | Logotipo y variantes | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c20/README.md) |
| BRD-C21 | Paleta y accesibilidad | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c21/README.md) |
| BRD-C22 | Design tokens | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c22/README.md) |
| BRD-C23 | Style Dictionary | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c23/README.md) |
| BRD-C24 | Plantillas y componentes | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c24/README.md) |
| BRD-C25 | Layouts responsive | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c25/README.md) |
| BRD-C26 | Composición y edición | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c26/README.md) |
| BRD-C27 | QA de texto | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c27/README.md) |
| BRD-C28 | QA visual y revisión | PARTIAL | PASS | PASS | [evidencia](docs/implementation/c28/README.md) |
| BRD-C29 | Brandbook y reglas | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c29/README.md) |
| BRD-C30 | Export y preflight | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c30/README.md) |
| BRD-C31 | Entrega y publicación | PARTIAL | PASS | PASS | [evidencia](docs/implementation/c31/README.md) |
| BRD-C32 | Aprendizaje y librería | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c32/README.md) |
| BRD-C33 | Reportes, dashboard e infografías | PARTIAL | PASS | PASS | [evidencia](docs/implementation/c33/README.md) |
| BRD-C34 | Portal responsive, chat y Anam | NOT_IMPLEMENTED | NOT_VERIFIED | NOT_VERIFIED | [evidencia](docs/implementation/c34/README.md) |
| BRD-C35 | SDK TypeScript, Hono y tools | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c35/README.md) |
| BRD-C36 | Bridge de agente y eventos | PARTIAL | PASS | PASS | [evidencia](docs/implementation/c36/README.md) |
| BRD-C37 | Cooperación y handoff empresarial | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c37/README.md) |
| BRD-C38 | Modelos, coste y observabilidad | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c38/README.md) |
| BRD-C39 | Privacidad y pruebas adversariales | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c39/README.md) |
| BRD-C40 | Vertical E2E y fallos distribuidos | IMPLEMENTED_LOCAL | PASS | PASS | [evidencia](docs/implementation/c40/README.md) |
| BRD-C41 | Operaciones, CI, backup y release | PARTIAL | PASS | NOT_VERIFIED | [evidencia](docs/implementation/c41/README.md) |
| BRD-C42 | Aceptación, evidencia y handoff final | PARTIAL | PASS | NOT_VERIFIED | [evidencia](docs/implementation/c42/README.md) |

## Lo que este estado no significa

- No significa "42 campañas terminadas". 10 campañas son parciales y 2 no tienen implementación utilizable.
- No significa proveedor verificado: ningún adaptador externo está configurado.
- No significa base de datos aplicada: el esquema existe y se verifica estáticamente, pero no se ha ejecutado contra Postgres en este entorno.
- No significa aceptación: no hay auditoría independiente ni visto bueno del owner.
