# Producto — Animal Traceability MVP v0.1

## Problema y objetivo

La empresa vende microchips RFID implantables y lectores, pero necesita demostrar un servicio de valor posterior a la venta: identificar un animal a partir de su chip, mantener su trazabilidad y facilitar su recuperación cuando se pierde. El MVP no pretende ser un ERP veterinario.

El objetivo es demostrar de extremo a extremo: microchip físico → lector HID → aplicación web → registro central → animal → propietario → historial de trazabilidad → estado perdido/encontrado → ficha pública de recuperación.

Los microchips actuales son Animal ID Microchip FDX-B, 134.2 kHz, ISO 11784/11785, encapsulados en bioglass y con identificadores numéricos. El lector W90D probado actúa como teclado USB HID: escribe el código y luego Enter. Para la aplicación, el lector solo es una fuente de entrada; no es parte del dominio.

## Usuarios

- Administrador de organización: administra los datos privados de su organización.
- Personal autorizado: escanea, registra animales y propietarios, consulta perfiles, agrega eventos y revisa reportes.
- Persona pública: consulta una ficha limitada usando un código de chip y puede reportar que encontró un animal.

## Propuesta de valor

Vender identificación física con un sistema sencillo que convierte un escaneo en una ficha trazable, permite reportar un animal como perdido y da una vía pública y segura para contactar a la organización cuando alguien lo encuentra.

## Alcance v0.1

- Inventario de microchips por organización.
- Escaneo HID y entrada manual de códigos numéricos.
- Registro transaccional de propietario, animal e implantación.
- Perfil privado del animal con timeline de eventos.
- Eventos de registro, implantación, vacunación, cambio de estado y nota.
- Cambios transaccionales perdido/encontrado.
- Ficha pública limitada por código de chip y reporte público de recuperación.
- Inbox de reportes y dashboard simple.
- Seguridad por organización mediante Auth, RLS y RPC limitadas.

## Fuera de alcance

No implementar app móvil, Bluetooth nativo/BLE GATT, WebUSB, Web Serial, drivers, notificaciones push, SMS, emails, offline, sincronización offline, expediente clínico completo, facturación, pagos, calendario, recordatorios, geolocalización, GPS, mapas, inventario financiero, transferencias complejas de propiedad, firma veterinaria, multi-país ni microservicios.

## Flujos principales

### Escaneo

En `/scan`, el usuario introduce un código por teclado HID o manualmente y confirma con Enter. La aplicación normaliza, valida y busca el código.

- Desconocido: muestra “Microchip no reconocido”; no modifica datos.
- Disponible: muestra “Microchip disponible” y ofrece “Registrar animal” hacia `/animals/new?chip=<code>`.
- Implantado: obtiene el animal asociado y navega a `/animals/:animalId`.
- Bloqueado: muestra “Microchip bloqueado”; no modifica datos, no navega al registro ni ofrece “Registrar animal”.

En v0.1, `available` no tiene animal asociado y puede registrarse; `implanted` tiene exactamente un animal asociado; y `blocked` está administrativamente inhabilitado, no tiene animal asociado y no puede usarse para registrar. No hay operaciones UI de bloquear o desbloquear chips dentro del alcance actual.

### Registro

Un microchip disponible permite crear propietario si corresponde, crear el animal, cambiar el chip a `implanted` y crear eventos `registration` e `implantation`. Es una sola operación transaccional. El animal, el microchip y el propietario deben pertenecer a la misma organización; RLS no reemplaza esta integridad.

### Trazabilidad y recuperación

El perfil privado muestra datos del animal, propietario autorizado y timeline ordenado por el momento en que ocurrió cada evento. Personal autorizado puede agregar vacuna, nota o cambio de estado. Cuando el animal está perdido, la ficha pública `/public/:chipCode` informa su estado sin revelar PII; una persona puede enviar un reporte de recuperación.

## Milestones

| Milestone | Entregable |
| --- | --- |
| M0 | Especificación |
| M1 | Bootstrap frontend |
| M2 | Base de datos |
| M3 | Auth, multi-tenancy y RLS |
| M4 | Inventario de microchips |
| M5 | Scanner HID |
| M6 | Registro de animal |
| M7 | Perfil y timeline |
| M8 | Perdido/encontrado |
| M9 | Ficha pública |
| M10 | Inbox de recovery reports |
| M11 | Dashboard |
| M12 | QA y demo |
| M13 | Deployment |

Una sesión futura implementa un único milestone por vez.

## Vertical slices

El primer gate es M0 → M1 → M2 → M3 → M4 → M5: con el W90D conectado por USB, escanear `990000015300168`, recibir Enter, consultar Supabase y mostrar “Microchip disponible”. No avanzar al registro completo antes de comprobarlo con el hardware real.

El segundo slice es M6 + M7: escanear el chip disponible, registrar a Luna, reescanear el mismo chip, abrir su perfil y mostrar su timeline. Esto produce el primer MVP demostrable.
