# C01 · Baseline real, inventario y matriz de drift — agntia-branding

**2026-11-14 · Auditoría de baseline (solo lectura + evidencia documental).**
Estado: **T01 PASS documental / T02–T06 BLOCKED / T07 PASS parcial.** No se ha escrito código de aplicación, no se ha ejecutado ningún test de producto, no se ha activado ningún proveedor, no se ha tocado `agente` ni repos hermanos.

---

## 1. Identidad del repositorio

| Campo | Valor |
|---|---|
| Repositorio asignado (contexto de la conversación) | `uniscrolliabrain-cloud/agntia-branding` |
| Dominio | Branding, diseño y sistemas de marca |
| `ownSHA` congelado | `7734d6d` — `docs(FreeBuff): reconciliar fabrica integral 42 campañas con documentación original` |
| Branch por defecto | `main` (sin protección de rama) |
| Visibilidad | pública |
| Ramas remotas | `main` (`7734d6d`), `docs/factory-prep-v1-20261113` (`d17db8a`), `docs/ultragranular-complete-program-20261114` (`dc59e94`) |
| PRs | #1 y #2 fusionadas el 2026-11-14 (solo documentación); 0 PRs abiertas; 0 issues abiertas |
| `hostSHA` de referencia del padre | `54b8d5407a8576459448c4d059a877297d18ca7a` — **no reverificado en esta auditoría** (no se lee el repo padre) |

Nota: al inicio de la sesión el clon estaba en `57f30db` (snapshot previo a la fusión de las dos ramas documentales). Se actualizó a `7734d6d` sin reescribir historia; `57f30db` es ancestro de `main`.

## 2. Inventario real (`git ls-files`)

| Métrica | Valor |
|---|---|
| Archivos versionados | **174** |
| Archivos `.md` | 169 |
| Archivos JSON (solo documentación/registros) | 5 (`campaign.json`, `document-validation.json`, `sources.json`, `repositories.json`, `parent-source-map.json`) |
| Código fuente (`.ts .tsx .js .jsx .mjs .cjs .sql .yml .yaml`) | **0** |
| `package.json` / `pnpm-workspace.yaml` / `tsconfig.json` | **ausentes** |
| CI / workflows | **ausentes** (`.github/workflows/` no existe) |
| Migraciones, esquemas SQL, RLS | **ausentes** |
| `.env`, secretos, credenciales | ninguno (correcto) |

### Clasificación CODE vs DOC

| Clase | Resultado |
|---|---|
| `CODE_PRESENT` | ninguna superficie |
| `CODE_PARTIAL` | ninguna superficie |
| `DOC_ONLY` | **las 42 campañas y todas las rutas de producto propuestas** |

No existe app, API, SDK, portal, worker, migración, adaptador, fixture ni test ejecutable. Cualquier afirmación de "implementado" en la documentación es `PROPOSED`/`DOC_ONLY`.

## 3. Comprobaciones ejecutadas (comandos y resultado real)

| Comprobación | Resultado |
|---|---|
| `git rev-parse HEAD` | `7734d6d` = `origin/main` |
| `git status --porcelain` | vacío antes de esta evidencia |
| `git ls-files \| wc -l` | 174 |
| `sha256sum docs/campaigns/campaign.json` | `ee21fea4…6305` — **coincide** con `document-validation.json` |
| Conteo del manifest | 42 campañas / 294 tareas / 84 gates / 9 checkpoints — **coincide** con README, handoff e informe |
| `grep -L DESIGN_ONLY docs/execution-program/campaigns/*/CAMPAIGN.md` | 0 archivos → **42/42 son `DESIGN_ONLY`** |
| Reportes `Estado: PENDING` | **42/42** |
| Dominios primarios propuestos únicos | 41 (rutas con forma real: `packages/adapters/src/penpot.ts`, `apps/web/src/views/BrandPortal.tsx`, etc.) |
| Rutas placeholder del generador | `apps/api/src/routes/`, `packages/contracts/src/`, `tests/campaigns/`, `docs/baseline.md` → **todas AUSENTES** |
| Build / typecheck / lint / tests | **NO EJECUTABLES** — no hay proyecto. `NOT_VERIFIED`, no `PASS`. |

## 4. Contradicciones registradas (gate antes de código irreversible)

1. **Capa PREP vs capa EXECUTION.**
   `docs/factory/HANDOFF-FREEBUFF.md` y `docs/factory/00-README.md`: *"No iniciar código todavía"*, requiere meta-auditoría conceptual del founder; los 42 folders son scaffolds no ejecutables.
   `docs/execution-program/03-PLAN-MAESTRO.md` y `FreeBuff/HANDOFF-RECONCILIADO-42-CAMPANAS.md`: implementar C01→C42 sin esperar auditorías intermedias.
   El propio handoff reconciliado ordena: *"preservar ambos, verificar aprobación del founder o registrar el conflicto como gate antes de código irreversible"*.
2. **AGENTS.md vs prompt maestro de fábrica.**
   `AGENTS.md` (alcance autorizado de este repo): solo investigación, informes, contratos, planning y campañas; **sin código de aplicación, tests ejecutables, SDK, contenedores ni despliegues**; una implementación futura requiere autorización propia.
   El prompt maestro recibido autoriza implementación autónoma. Ambas cosas no pueden ser ciertas a la vez: falta decisión explícita del founder sobre el cambio de alcance.
3. **Placeholders en los CAMPAIGN.md.** DTO/API/tests usan rutas numeradas (`packages/contracts/src/01.ts`, `apps/api/src/routes/01.ts`, `tests/campaigns/001.test.ts`) que no existen; C42 nombra `.github/workflows/ci.yml` como "dominio principal". Son plantillas, no patchsets verificados.
4. **Ruta de trabajo del handoff.** `docs/release/HANDOFF.md` indica `/workspace/agntia-branding`; el checkout real es el worktree de este chat. Sin impacto, pero conviene corregirlo.

## 5. Estado por campaña

| Bloque | Campañas | Estado real |
|---|---|---|
| Fundaciones | C01–C08 | `DESIGN_ONLY` · 0/56 tareas · 0/16 gates |
| Dominio | C09–C32 | `DESIGN_ONLY` · 0/168 tareas · 0/48 gates |
| Exposición/ops/aceptación | C33–C42 | `DESIGN_ONLY` · 0/70 tareas · 0/20 gates |
| **Total** | **42** | **0/294 tareas · 0/84 gates ejecutados** |

## 6. Decisiones requeridas antes de continuar

1. **Autorización de implementación en este repo** (cambia el alcance de `AGENTS.md` de `DOCUMENTATION_ONLY` a ejecución de código).
2. **Precedencia**: ¿manda la capa EXECUTION (implementar ya) o la capa PREP (esperar meta-auditoría conceptual y granularizar patchsets)? Si manda EXECUTION, ¿se acepta que los `CAMPAIGN.md` actuales son scaffolds y que los paths de DTO/API/tests se fijan en la primera campaña?
3. **Política de ramas**: rama por campaña con PR, o una rama de fábrica con commits por campaña. `main` no debe recibir merges sin aprobación del founder.

## 7. Plan inmediato si el founder autoriza (C01→C05)

- **C01** — cerrar lo documental ya hecho: `docs/execution-evidence/C01-BASELINE-AUDIT.md` (este archivo) + `docs/baseline.md` con SHAs, fuentes y `permissions`.
- **C02** — `docs/architecture/05-authority-map.md` + `AuthorityMap` tipado (dominio puro, sin I/O).
- **C03** — `packages/contracts`: verificación JWT Supabase (firma/issuer/audience/alg/tiempos/JWKS cacheado) + `Principal` con membership provisionada; tests con tokens sintéticos (otro proyecto, alg inválido, expirado, `user_metadata` hostil).
- **C04** — `TwinBinding` (runtimeId/roleId/personaId separados, mandato con purpose/budget/expiry/revocationVersion) sin registro soberano nuevo.
- **C05** — envelope Zod v1, `Money` decimal string, `EvidenceRef`, `ApprovalBinding`, `OperationResult` discriminado, errores normalizados; round-trip y rechazo de campos extra.
- Primer bootstrap del monorepo: `package.json`, `pnpm-workspace.yaml`, `tsconfig` base, `vitest`, CI mínima. **Sin** proveedores, sin Supabase real, sin despliegue.

Todo lo anterior queda `NOT_VERIFIED` hasta que exista entorno y se ejecuten los comandos.

## 8. Evidencia reproducible

```text
git rev-parse HEAD                -> 7734d6d99ad84643be1e4f62c600c35356a603fe
git status --porcelain            -> (vacío)
git ls-files | wc -l              -> 174
sha256sum docs/campaigns/campaign.json
                                  -> ee21fea48b7e8b98ab4d846730a99d78604a25d6dcbba35f6a71e3836ae85305
jq '.campaigns|length'            -> 42   (tareas 294, gates 84)
```

Sin PII, sin tokens, sin originales restringidos.
