# Demo — Animal Traceability MVP v0.1

## Preparación de entorno

Cuando los milestones correspondientes estén implementados, preparar una organización, un usuario de personal con membresía, el frontend configurado contra el proyecto Supabase de demo y la base de datos migrada. Cargar el seed de demostración antes de la presentación.

El seed debe contener el chip físico real sin vincular a animal:

```text
code:          990000015300168
status:        available
technology:    FDX-B
frequency_khz: 134.2
standard:      ISO 11784/11785
```

No usar este chip para crear un animal antes de iniciar la demo. Tras una demo completa, restaurar el entorno de demo o usar un seed nuevo antes de la siguiente presentación, pues el registro lo cambiará a `implanted`.

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
    - Resultado: se ve el reporte pendiente asociado a Luna.

## Plan de recuperación si falla el lector

1. No simular que se validó hardware: verificar alimentación y conexión USB del W90D.
2. Hacer clic en un campo de texto simple del navegador o editor y escanear para confirmar el comportamiento HID: código seguido de Enter.
3. Si el lector sí escribe allí, volver a `/scan`, enfocar ScannerInput y repetir. Si falla, usar la entrada manual con `990000015300168`; explicar que esto permite continuar la demo funcional, pero no sustituye la validación física.
4. Si el código no es reconocido, detener el guion de registro, verificar que el seed y el entorno apuntado corresponden a la demo y comprobar que el chip no se consumió en una demostración anterior.
5. Si el chip figura `blocked`, no intentar registrarlo ni desbloquearlo desde UI: verificar configuración/seed y restaurar el entorno de demo.
6. Si el chip ya figura implantado por una demo anterior, restaurar el seed/entorno antes de repetir el flujo de disponible → registro.

## Checklist previo a presentación

- [ ] Migraciones aplicadas y seed de demo cargado.
- [ ] `990000015300168` existe, está `available` y no tiene animal asociado; no está `blocked` ni `implanted`.
- [ ] Usuario de personal y membresía de organización probados.
- [ ] W90D, cable USB y puerto físico probados en un navegador real.
- [ ] Escaneo real escribe el código y Enter en un campo simple.
- [ ] `/scan` fue probado con lector y con entrada manual.
- [ ] Perfil público fue probado en sesión anónima y no revela PII.
- [ ] Flujo de reporte público y recovery inbox verificados.
- [ ] Estados loading, empty y error revisados para pantallas de la demo.
- [ ] TypeScript, lint, pruebas relevantes y build aprobados para el milestone desplegado.
- [ ] Plan de restauración del seed disponible entre demostraciones.

## Gates de progreso

Primer vertical slice (M0–M5): W90D → USB → navegador → escanear `990000015300168` → Enter → Supabase → “Microchip disponible”. No proceder al registro completo sin esta prueba física.

Segundo vertical slice (M6–M7): escaneo disponible → registrar Luna → reescanear → perfil de Luna → timeline. Desde aquí el MVP ya es demostrable; M8–M13 completan pérdida/encontrado, ficha pública, inbox, dashboard, QA y despliegue.
