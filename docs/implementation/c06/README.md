# BRD-C06 · Persistencia, RLS y migraciones — evidencia de implementación

Estado: **PARTIAL**. Generado 2026-11-15T15:07:38.312Z sobre `6870a10a5f163fa3a07685f6facdcd6a9e8e7c61`.

18 tablas con RLS y FORCE, FK compuestas por tenant, roles app_api/app_worker y seed A/B/P determinista.

- Campaña original: [`docs/campaigns/06-`](../../campaigns/)
- Programa de ejecución: [`CAMPAIGN.md`](../../execution-program/campaigns/006/CAMPAIGN.md)
- Scaffold conceptual (no movido): [README](../06-*/README.md)

## Qué es real

18 tablas con RLS y FORCE, FK compuestas por tenant, roles app_api/app_worker y seed A/B/P determinista.

## Qué falta

El esquema no se ha aplicado a una base real; las políticas no se han probado con dos sesiones.

Ver también [EVIDENCE](EVIDENCE.md) · [TESTS](TESTS.md) · [RISKS](RISKS.md).
