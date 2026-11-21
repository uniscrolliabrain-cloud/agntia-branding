# BRD-C30 · Export y preflight — evidencia de implementación

Estado: **IMPLEMENTED_LOCAL**. Generado 2026-11-21T16:18:09.403Z sobre `7de366159bb14a3fd2f8639a443090dbf5f652d8`.

Manifiesto ligado a editable/render/fuente/derechos/DPI/perfil y bytes reales de PDF, PNG y SVG generados sin dependencias, con sha256 del archivo y aceptación explícita de toda sustitución.

- Campaña original: [`docs/campaigns/30-`](../../campaigns/)
- Programa de ejecución: [`CAMPAIGN.md`](../../execution-program/campaigns/030/CAMPAIGN.md)
- Scaffold conceptual (no movido): [README](../30-*/README.md)

## Qué es real

Manifiesto ligado a editable/render/fuente/derechos/DPI/perfil y bytes reales de PDF, PNG y SVG generados sin dependencias, con sha256 del archivo y aceptación explícita de toda sustitución.

## Qué falta

El PDF usa base-14 Helvetica y el PNG un bitmap 5x7 integrado: no se embebe la fuente licenciada, y path/imagen embebida fallan cerrado porque el modelo no los dibuja.

Ver también [EVIDENCE](EVIDENCE.md) · [TESTS](TESTS.md) · [RISKS](RISKS.md).
