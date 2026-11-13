# Auditoría ligera de preparación — Branding (2026-11-13)

**Resultado: PREP DOCUMENTAL REALIZADA / CAMPAÑAS AÚN NO GRANULARES.** No código, tests ni proveedores comprobados. Esta revisión es de coherencia conceptual, no meta-auditoría de Astra.

## Observado
README indica DOCUMENTATION_ONLY y 42 campañas NOT_STARTED; `docs/campaigns/campaign.json` contiene 42 campañas, 294 tareas, 84 escenarios; `docs/01-producto.md` describe estrategia, naming, identidad, editor vectorial, QA, rights y brandbook; `docs/contracts/01-contratos.md` define propuestas de DTO; `docs/architecture/03-compatibilidad-agente.md` referencia SHA padre `54b8d5407a8576459448c4d059a877297d18ca7a` con lectura parcial. No inferir implementación por tamaño de repo o documentación.

## Aportaciones de esta preparación
Índice PREP sin destruir originales; factory con cuatro participantes; léxico transversal y específico; contrato ADTC; visión agencia integral; fronteras con Diseño futuro, Marketing, Redes, Vídeo, Legal; puertos/adapters; 42 carpetas de campaña y un handoff de ejemplo C01.

## Cuestiones abiertas para la futura meta-auditoría conceptual
- ¿La agencia cubre estrategia de marca completa o sesga el plan hacia herramientas vectoriales?
- ¿Dónde termina Branding y empieza Diseño web/gráfico?
- ¿Cómo preservar coherencia visual y derechos a través de campañas y proveedores?
- ¿Qué vertical P0 aporta valor real con mínimo acoplamiento?
- ¿Qué componentes se comparten con padre y cuáles permanecen especializados?
- ¿Cómo evitar rigidez del boilerplate y permitir innovación por dominio?

## Siguiente etapa
Founder aporta auditoría conceptual independiente cuando esté disponible; reconciliar ideas, no imponerle rúbrica. Después diseñar campañas realmente granulares con rutas y patchsets al código vigente. Hasta entonces los 42 folders son **scaffolds** y no instrucciones ejecutables. No modificar padre, vídeo, ciberseguridad, gestoría, main ni servicios externos.
