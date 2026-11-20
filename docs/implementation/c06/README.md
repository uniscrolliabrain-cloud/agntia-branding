# BRD-C06 · Persistencia, RLS y migraciones — evidencia de implementación

Estado: **IMPLEMENTED_LOCAL**. Generado 2026-11-20T13:46:48.852Z sobre `133db71b5c8d23b23f9bee98b2b3f853953c0302`.

Esquema aplicado a un PostgreSQL 18 real: 18 tablas con RLS y FORCE, aislamiento A/B comprobado con app_api y app_worker, CHECK cruzado y FK compuesta rechazados.

- Campaña original: [`docs/campaigns/06-`](../../campaigns/)
- Programa de ejecución: [`CAMPAIGN.md`](../../execution-program/campaigns/006/CAMPAIGN.md)
- Scaffold conceptual (no movido): [README](../06-*/README.md)

## Qué es real

Esquema aplicado a un PostgreSQL 18 real: 18 tablas con RLS y FORCE, aislamiento A/B comprobado con app_api y app_worker, CHECK cruzado y FK compuesta rechazados.

## Qué falta

No se ha aplicado a un entorno gestionado (Supabase) ni con credenciales reales; el superusuario evade RLS por diseño y por eso no es el rol de la aplicación.

Ver también [EVIDENCE](EVIDENCE.md) · [TESTS](TESTS.md) · [RISKS](RISKS.md).
