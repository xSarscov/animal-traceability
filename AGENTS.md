# Instrucciones operativas — Animal Traceability

## Alcance y orden de trabajo

Este repositorio implementa un MVP web de identificación y trazabilidad animal mediante microchips RFID. Antes de modificar código, leer `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN_RULES.md` y `docs/DEMO.md`.

Implementar solamente el milestone solicitado, en orden M0–M13. No anticipar funcionalidades de milestones posteriores, salvo infraestructura estrictamente necesaria para el milestone actual. M0 es exclusivamente especificación.

No cambiar silenciosamente la arquitectura, el stack aprobado, las rutas, el modelo de dominio o el alcance. Si una desviación parece necesaria, documentarla y solicitar decisión explícita antes de aplicarla.

## Límites técnicos

- Mantener un único repositorio; no convertirlo en monorepo durante el MVP.
- Usar el stack aprobado: React, Vite, TypeScript, React Router, Tailwind CSS, React Hook Form, Zod, Supabase/PostgreSQL, Vitest, React Testing Library y Playwright.
- No agregar Next.js, Redux, Zustand, Node/Express separado, ORM ni microservicios sin una justificación aprobada y documentada.
- No acoplar el dominio al lector W90D, USB o un fabricante. El lector es una fuente de entrada de texto HID; el dominio recibe un código de microchip normalizado.
- No implementar WebUSB, Web Serial, drivers o librerías específicas del lector. La futura compatibilidad Bluetooth HID debe reutilizar el mismo flujo de entrada.

## Reglas de seguridad y dominio

- `docs/DOMAIN_RULES.md` es normativo. No debilitar DR-001 a DR-008 mediante UI, migraciones, RPC ni excepciones ad hoc.
- Las invariantes multi-entidad se implementan mediante transacciones PostgreSQL/RPC, nunca como múltiples escrituras independientes desde React.
- RLS no sustituye la integridad referencial entre tenants: un animal, su microchip y su propietario deben pertenecer a la misma organización. En M2 se elegirá y documentará el refuerzo PostgreSQL efectivo antes de implementar operaciones que puedan violarlo.
- Mantener RLS en todas las tablas privadas. No desactivarlo ni usar políticas abiertas como `USING (true)` para resolver problemas.
- Los usuarios anónimos no tienen acceso directo a datos privados. La ficha pública y el envío de reportes deben pasar por funciones limitadas que no devuelvan PII del propietario.
- No almacenar secretos en el repositorio. Mantener `.env.example` sin valores sensibles cuando llegue el milestone correspondiente.

## Calidad, documentación y entrega

- Al finalizar cada milestone, ejecutar los checks aplicables: TypeScript, lint, pruebas relevantes y build. Informar con precisión qué se ejecutó y qué no pudo verificarse.
- Implementar loading, empty y error states cuando el milestone incluya UI o datos.
- No declarar terminado un milestone solo porque la UI parece funcionar; validar sus criterios de aceptación y sus reglas de seguridad aplicables.
- Actualizar la documentación cuando cambie una decisión relevante de producto, arquitectura o dominio. Informar de toda desviación y de los supuestos realizados.
- Mantener fuera de alcance: app móvil, BLE GATT, notificaciones, SMS/email, offline, expediente clínico completo, facturación, pagos, calendario, GPS/mapas, transferencias complejas, firma veterinaria, multi-país y microservicios.

## Hardware y demo

El chip físico reservado es `990000015300168`. En seed debe iniciar como `available`, sin animal asociado, con tecnología FDX-B, frecuencia 134.2 kHz y estándar ISO 11784/11785. No consumirlo ni vincularlo en seeds.

La prueba manual del lector W90D es obligatoria antes de afirmar compatibilidad física: USB → navegador real → código → Enter → lookup correcto. Las pruebas automatizadas no sustituyen esa validación.
