# Demo — Animal Traceability MVP v0.1

## Preparación de entorno

Preparar el frontend contra Supabase local, levantar el stack desde Ubuntu/WSL y cargar el seed de demostración antes de la presentación. M3 ya incluye la organización `Animal Traceability Demo` y dos usuarios locales reproducibles:

- Administrador: `admin@animal-traceability.test` / `DemoAdmin123!`.
- Personal: `staff@animal-traceability.test` / `DemoStaff123!`.

Ambos pertenecen a la organización demo; las credenciales son exclusivamente locales y nunca deben copiarse a Supabase Cloud. Antes de la demo, verificar login y membership con el rol que se vaya a usar.

El seed debe contener el chip físico real sin vincular a animal:

```text
code:          990000015300168
status:        available
technology:    FDX-B
frequency_khz: 134.2
standard:      ISO 11784/11785
```

No usar este chip para crear un animal antes de iniciar la demo. Tras una demo completa, restaurar el entorno de demo o usar un seed nuevo antes de la siguiente presentación, pues el registro lo cambiará a `implanted`.

### Gate de readiness posterior a `db reset`

Un contenedor Docker o PostgreSQL marcado como `healthy` no basta para iniciar la demo: Auth y otros servicios pueden estar vivos antes de que migrations y seed estén listos. Después de `supabase db reset`, esperar su exit 0 y comprobar, sin usar una espera fija:

1. `supabase db reset` terminó con exit `0`.
2. `SELECT to_regclass('public.microchips') IS NOT NULL;` devuelve `true`.
3. El chip `990000015300168` existe y su `status` es `available`.
4. Ejecutar `npm run qa:readiness`, que comprueba Auth, PostgREST autenticado/anónimo y baseline `0 / 1 / 0 / 0 / 0`.
5. Solo entonces abrir frontend, login o una sesión anónima.

## Guion exacto y resultados esperados

1. Mostrar el microchip físico `990000015300168`.
   - Resultado: se establece que el código corresponde a un objeto físico real.
2. Conectar el W90D por USB y abrir `/scan` en un navegador real, con el campo ScannerInput enfocado.
   - Resultado: el lector está listo para escribir como teclado HID; no se instala driver ni se abre permiso WebUSB/Serial.
3. Escanear el chip físico.
   - Resultado: el lector escribe `990000015300168` y envía Enter; la aplicación normaliza, valida y consulta.
4. Confirmar “Microchip disponible”.
   - Resultado: no hay cambios automáticos de datos y aparece la acción “Registrar animal”.
5. Elegir “Registrar animal” y completar el registro de un animal llamado Luna con su propietario.
   - Resultado: una transacción crea los datos requeridos, cambia el chip a `implanted` y crea los eventos `registration` e `implantation`.
6. Volver a `/scan` y escanear el mismo chip.
   - Resultado: ya no aparece disponible; la aplicación abre automáticamente `/animals/:animalId` para Luna.
7. Mostrar el perfil de Luna y su timeline.
   - Resultado: se ven los datos privados solo para personal autorizado y los eventos se ordenan por `occurred_at`.
8. Registrar una vacuna.
   - Resultado: se agrega un evento `vaccination` con metadata, sin crear un expediente clínico completo.
9. Marcar a Luna como perdida.
   - Resultado: el estado cambia de `active` a `lost` y aparece un evento `status_change` mediante una operación transaccional.
10. Abrir `/public/990000015300168` en contexto anónimo.
   - Resultado: muestra que Luna está perdida y solo datos públicos; no expone propietario, contacto, dirección ni IDs internos.
11. Enviar un reporte de “animal encontrado”.
   - Resultado: se crea un `recovery_report` `pending` sin conceder al visitante acceso a los datos privados.
12. Volver como personal a `/recovery-reports`.
   - Resultado: se ve el reporte pendiente asociado a Luna; se marca como revisado, se puede abrir el animal, marcarlo encontrado mediante M8 y cerrar el reporte ya revisado sin alterar nuevamente el animal.

## Plan de recuperación si falla el lector

1. No simular que se validó hardware: verificar alimentación y conexión USB del W90D.
2. Hacer clic en un campo de texto simple del navegador o editor y escanear para confirmar el comportamiento HID: código seguido de Enter.
3. Si el lector sí escribe allí, volver a `/scan`, enfocar ScannerInput y repetir. Si falla, usar la entrada manual con `990000015300168`; explicar que esto permite continuar la demo funcional, pero no sustituye la validación física.
4. Si el código no es reconocido, detener el guion de registro, verificar que el seed y el entorno apuntado corresponden a la demo y comprobar que el chip no se consumió en una demostración anterior.
5. Si el chip figura `blocked`, no intentar registrarlo ni desbloquearlo desde UI: verificar configuración/seed y restaurar el entorno de demo.
6. Si el chip ya figura implantado por una demo anterior, restaurar el seed/entorno antes de repetir el flujo de disponible → registro.

## Gate físico M5

M5 usa exclusivamente un formulario HTML con el `ScannerInput` enfocado. El Enter enviado por el W90D ejecuta el submit normal: no hay WebUSB, Web Serial, Bluetooth, listener global ni heurística de velocidad. La entrada manual usa exactamente el mismo flujo y es un fallback de software, no una sustitución de la prueba física HID.

Estado de validación física de M5: **PASS**. El gate ejecutado fue W90D físico → USB → navegador real → `/scan` → ScannerInput → `990000015300168` → Enter → Supabase → “Microchip disponible”. La entrada manual también fue validada.

## Segundo vertical slice M6–M7

Estado: **PASS**. Se ejecutó con el usuario local `staff@animal-traceability.test`: escaneo del chip disponible, registro de Luna, apertura de “Ver perfil”, verificación de los eventos iniciales, registro de una vacunación y una nota, y reescaneo hacia el mismo perfil. Después se ejecutó `db reset`; el chip volvió a `available` sin animal asociado.

## Validación M8 — Perdido/encontrado

Estado: **PASS**. Se ejecutó con `staff@animal-traceability.test`: registro de Luna, transición a perdido, reescaneo hacia el mismo perfil sin alterar el estado y transición a encontrado. La base confirmó dos eventos `status_change`, ambos realizados por el usuario staff. Después se ejecuta `db reset` para restaurar el chip de demo.

## Validación M9 — ficha pública/reporte

Estado: **PASS**. Se ejecutó con un contexto de navegador independiente y sin sesión (`localStorage.length = 0`): se registró Luna con datos canario de propietario, se marcó como perdida y se abrió `/public/990000015300168`. La ficha mostró únicamente los campos públicos aprobados; no expuso nombre, teléfono, email ni dirección del propietario. El visitante anónimo envió un reporte y la base confirmó un único `recovery_report` asociado con estado `pending`. Tras la validación se ejecutó `db reset`; el chip `990000015300168` volvió a `available`, sin animales asociados y sin reportes de recuperación.

## Validación M10 — Recovery Inbox

Estado: **PASS**. Tras el gate de readiness se registró Luna, se marcó como perdida y un contexto anónimo real envió el reporte `pending`. Como staff, `/recovery-reports` mostró los datos privados del reportante, avanzó el reporte a `reviewed`, abrió el animal y lo marcó como encontrado. El inbox conservó el reporte cuando Luna ya estaba `active` y permitió cerrarlo en `closed`. La base confirmó un único reporte cerrado, Luna `active` y el microchip `implanted` antes del reset final.

## Validación M11 — Dashboard simple

Estado: **PASS**. Tras el gate de readiness, el dashboard privado mostró el baseline `0 / 1 / 0 / 0 / 0` (animales, disponibles, implantados, perdidos, reportes pendientes). Después de registrar Luna mostró `1 / 0 / 1 / 0 / 0`; tras marcarla perdida y enviar un reporte anónimo real mostró `1 / 0 / 1 / 1 / 1`; luego de revisar el reporte y marcar a Luna encontrada mostró `1 / 0 / 1 / 0 / 0`. El reset final restauró el chip de demo disponible, sin animal ni reportes.

## Validación M12 — QA/E2E

Estado: **PASS**. Tras `db reset` y el gate HTTP de Auth/PostgREST, Playwright ejecutó en Chromium el flujo estatal M5–M11 completo: login, dashboard, scanner con entrada manual, registro de Luna, perfil privado con PII canario, vacunación, nota, perdido, re-scan, ficha pública anónima sin PII, reporte `pending`, inbox `reviewed`, encontrado, cierre `closed`, dashboard y logout. Las 272 pruebas pgTAP, checks frontend y advisors de seguridad pasaron. Playwright no repite ni sustituye el gate físico W90D M5, que permanece como evidencia manual separada. El reset final y readiness restauraron `0 / 1 / 0 / 0 / 0`.

## Deployment M13

Estado: **PASS**. Las migrations versionadas se aplicaron al proyecto Supabase Cloud `xuxgavoxxeafshmirjpv` sin seed; Auth/signup, organización `test-org`, membership e inventario fueron configurados administrativamente. Vercel publica `https://animal-traceability-five.vercel.app` y el smoke hosted read-only verificó login, dashboard, inventario, scanner, inbox, deep links y logout. No se ejecutaron escrituras en Cloud durante el smoke. Consulte [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Checklist previo a presentación

- [x] Migraciones aplicadas y seed de demo cargado; `db reset` terminó con exit `0`.
- [x] `npm run qa:readiness` confirma `0 / 1 / 0 / 0 / 0` antes de la demo.
- [x] `990000015300168` existe, está `available` y no tiene animal asociado; no está `blocked` ni `implanted`.
- [x] Usuario de personal y membresía de organización probados.
- [x] Login y logout locales probados con `staff@animal-traceability.test`; el acceso anónimo no revela tablas privadas.
- [ ] W90D, cable USB y puerto físico probados en un navegador real.
- [ ] Escaneo real escribe el código y Enter en un campo simple.
- [ ] `/scan` fue probado con lector y con entrada manual.
- [x] Gate físico M5 W90D → USB HID → navegador → Enter → “Microchip disponible”.
- [x] Perfil público fue probado en sesión anónima y no revela PII.
- [x] Flujo de reporte público verificado; crea un reporte `pending` sin conceder lectura anónima.
- [x] Smoke Recovery Inbox: pending → reviewed → animal encontrado → closed.
- [x] Dashboard: baseline, registro, perdido, reporte pendiente, revisado y encontrado.
- [x] Estados loading, empty y error revisados para pantallas de la demo.
- [x] TypeScript, lint, pruebas relevantes y build aprobados para el milestone desplegado.
- [x] Plan de restauración del seed: `db reset` explícito y readiness posterior.

## Gates de progreso

Primer vertical slice (M0–M5): W90D → USB → navegador → escanear `990000015300168` → Enter → Supabase → “Microchip disponible”. No proceder al registro completo sin esta prueba física.

Segundo vertical slice (M6–M7): escaneo disponible → registrar Luna → reescanear → perfil de Luna → timeline. Desde aquí el MVP ya es demostrable; M8–M12 completan perdido/encontrado, ficha pública, inbox, dashboard y QA. M13 deja el frontend publicado en Vercel y el backend versionado en Supabase Cloud.
