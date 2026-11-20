# BRD-C06 — riesgos y deuda

- Un despliegue que conecte como superusuario o service_role anularía la prueba entera

## Límite de esta evidencia

No se ha aplicado a un entorno gestionado (Supabase) ni con credenciales reales; el superusuario evade RLS por diseño y por eso no es el rol de la aplicación.

El núcleo determinista está cubierto por tests locales. La integración real, el render final y la aceptación humana siguen pendientes.
