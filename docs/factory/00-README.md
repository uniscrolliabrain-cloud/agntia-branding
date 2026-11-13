# Agntia Engineering Factory — Branding

**factoryVersion: 0.1.0 | domainProfile: branding | DESIGN/PREP | 2026-11-13**

Objetivo: elevar el repositorio al mismo nivel de preparación arquitectónica que Marketing y Formación, **sin granularizar todavía las 42 campañas ni escribir runtime**. El founder hará meta-auditoría conceptual independiente antes de profundizar.

## Lectura obligatoria
1. `docs/prep/README.md`; `docs/factory/00-README.md` a `06-READINESS-AUDIT.md`.
2. Originales `docs/01-producto.md`, `docs/architecture/`, `docs/contracts/`, `docs/05-seguridad-privacidad.md`, `docs/research/`.
3. `docs/campaigns/README.md` y `campaign.json`; documento original de la campaña.
4. `docs/implementation/NN-*/README.md` y, cuando existan, handoffs específicos.
5. Contexto N−1/N/N+1 y contratos canónicos del padre, siempre con SHA.

## Principios
Kernel, bus, grafo, identidades y políticas canónicos en `agente`; especialistas como servicios delegados, agentes canónicos con twins vinculados, no registro soberano paralelo. LLM propone; sistema autoriza/ejecuta. Solapamiento funcional permitido; efectos únicos por intención. Multi-tenant, ACL y trazabilidad desde el diseño. Adaptadores opcionales y versionados. No modificar padre, main, proveedores ni desplegar.

## Grados de certeza
`DOC_ONLY`, `PROPOSED`, `CODE_VERIFIED`, `TEST_VERIFIED`, `STALE`, `UNKNOWN`. No confundir investigación, promesa comercial, capacidad declarada y prueba real. No asumir que todas las 42 campañas deban mantenerse sin revisión conceptual.

## Reutilización
La factory es una convención versionada; el perfil Branding contiene reglas propias de identidad de marca, licencias, autoría, archivos editables, aprobación y exportación. Una mejora transversal se propone como cambio de versión, nunca se impone silenciosamente a hermanos.
