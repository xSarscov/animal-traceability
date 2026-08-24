# Dominio y reglas — Animal Traceability MVP v0.1

Este documento es normativo: las reglas DR-001 a DR-008 son invariantes de producto y deben reforzarse con constraints, RLS y RPC cuando corresponda.

## Entidades y relaciones

| Entidad | Datos clave | Relaciones y restricciones |
| --- | --- | --- |
| `organizations` | `id` UUID PK, `name` obligatorio, `slug` único, `created_at` | Tenant de los datos privados. |
| `organization_members` | `organization_id`, `user_id` de `auth.users`, `role` `admin` o `staff` | PK compuesta (`organization_id`, `user_id`). |
| `owners` | UUID PK, `organization_id`, `full_name` obligatorio, teléfono, email, dirección nullable, timestamps | Un propietario pertenece a una organización. |
| `microchips` | UUID PK, `organization_id`, `code` único, tecnología FDX-B, 134.2 kHz, ISO 11784/11785, batch nullable, estado, timestamps | Un chip puede asociarse a cero o un animal. El código físico no es PK. |
| `animals` | UUID PK, organización, `microchip_id`, `owner_id`, nombre/especie obligatorios, raza nullable, sexo, nacimiento/color nullable, estado, timestamps | `microchip_id` es UNIQUE; por tanto, un animal usa un solo chip y un chip no se comparte. |
| `animal_events` | UUID PK, `animal_id`, tipo, título obligatorio, descripción nullable, metadata JSONB, `performed_by` nullable, `occurred_at`, `created_at` | Historial append-only, ordenado por `occurred_at`. |
| `recovery_reports` | UUID PK, `animal_id`, nombre y contacto obligatorios, mensaje nullable, estado, `created_at` | Un reporte público referencia un animal sin exponer sus datos privados. |

`auth.users` es administrada por Supabase; no existe una tabla adicional `users` en v0.1.

## Estados y tipos permitidos

- `organization_members.role`: `admin`, `staff`.
- `microchips.status`: `available`, `implanted`, `blocked`.
- `animals.sex`: `male`, `female`, `unknown`.
- `animals.status`: `active`, `lost`, `deceased`.
- `animal_events.event_type`: `registration`, `implantation`, `vaccination`, `status_change`, `note`.
- `recovery_reports.status`: `pending`, `reviewed`, `closed`.

### Asociación requerida por estado de microchip

| Estado | Animales asociados | Uso en v0.1 |
| --- | --- | --- |
| `available` | 0 | Puede usarse para registrar un animal. |
| `implanted` | Exactamente 1 | El escaneo abre el perfil de ese animal. |
| `blocked` | 0 | Está administrativamente inhabilitado; no puede registrar un animal. |

El sistema nunca debe producir `available` con un animal asociado, `blocked` con un animal asociado ni `implanted` sin animal asociado. La implementación concreta de estas invariantes pertenece a M2/M6; no se implementa en M0.

Una vacuna usa `animal_events.metadata` durante el MVP; ejemplo: `{ "vaccine": "Rabia", "batch": "AR-2026-24", "nextDose": "2027-09-10" }`. No crear un subsistema clínico separado.

## Reglas de dominio

### DR-001 — Identidad física

`microchips.code` es globalmente UNIQUE. Un código físico nunca se reutiliza para otro registro. El código se conserva como texto normalizado, no como clave primaria ni valor numérico.

### DR-002 — Relación animal/microchip

Un microchip se asocia como máximo a un animal. `animals.microchip_id` es UNIQUE.

### DR-003 — Registro e implantación

Para registrar un animal con chip, el chip debe estar `available`. `register_animal_with_chip(...)` debe ejecutar en una sola transacción: crear propietario cuando corresponda, crear animal, actualizar el chip a `implanted`, insertar evento `registration` e insertar evento `implantation`. Si falla cualquier paso, todo hace rollback. React no puede repartir esta operación en múltiples writes independientes.

### DR-004 — Historial append-only

Los `animal_events` son trazabilidad histórica. En el MVP se insertan y consultan, pero no se editan ni eliminan desde UI. Una corrección futura genera un evento adicional, no altera el pasado. La timeline se ordena por `occurred_at`, nunca por `created_at`.

### DR-005 — Escanear no modifica datos

El escaneo es solo lectura. Nunca provoca automáticamente cambio de propietario/estado, implantación, vacunación ni modificación del animal.

### DR-006 — Estados perdido/encontrado

`active → lost` se realiza por `mark_animal_lost(...)` en una transacción que actualiza `animals.status` e inserta `animal_events` de tipo `status_change`. `lost → active` se realiza del mismo modo por `mark_animal_found(...)`. No se infiere ni cambia un estado a partir de un escaneo.

### DR-007 — Privacidad pública

La ficha pública nunca expone nombre, teléfono, email o dirección del propietario; tampoco IDs internos ni información administrativa privada. Esta protección es responsabilidad del backend/base de datos y no solo de React.

### DR-008 — Consistencia de organización

Un animal, su microchip y su propietario deben pertenecer siempre a la misma organización. Para un animal `A`:

```text
A.organization_id = A.microchip.organization_id = A.owner.organization_id
```

No debe ser posible crear ni modificar un animal de modo que produzca referencias cruzadas entre tenants. Esta invariante debe reforzarse posteriormente en PostgreSQL y no depender solo de validaciones React o RLS. En M2 se decidirá la implementación concreta, preferiblemente mediante integridad relacional efectiva —por ejemplo, claves/constraints compuestas cuando resulte apropiado— y RPC transaccionales. RLS sigue siendo obligatorio, pero no sustituye esta integridad referencial.

## Invariantes de seguridad y acceso

- Un usuario autenticado solo lee o modifica datos privados de organizaciones de las que sea miembro.
- RLS protege todas las tablas privadas; no se permiten políticas abiertas como `USING (true)`.
- Un anónimo no consulta directamente `owners`, `animals`, `microchips`, `animal_events`, `organizations` ni `organization_members`.
- `get_public_animal_by_chip(code)` solo devuelve el contrato público documentado en `ARCHITECTURE.md`.
- `submit_recovery_report(...)` permite crear un reporte desde el código del chip sin otorgar lectura directa ni acceso general a `recovery_reports`.

## Semántica de escaneo

Tras normalizar y validar entrada de solo dígitos y longitud razonable hay cuatro resultados:

- Caso A — desconocido: mostrar “Microchip no reconocido”, sin escrituras.
- Caso B — `available`: mostrar “Microchip disponible” y CTA “Registrar animal” hacia `/animals/new?chip=<code>`.
- Caso C — `implanted`: buscar el único animal asociado y abrir `/animals/:animalId`.
- Caso D — `blocked`: mostrar “Microchip bloqueado”, sin escrituras, sin navegación a registro y sin CTA “Registrar animal”.

Escanear siempre es lectura, incluso en el caso `blocked`. La validación v0.1 no declara que todos los chips deban tener exactamente 15 dígitos. No se implementan todavía operaciones UI de bloqueo/desbloqueo.

## Chip reservado de demostración

El seed incluye exactamente el microchip físico `990000015300168` con `status = available`, sin animal asociado, `technology = FDX-B`, `frequency_khz = 134.2` y `standard = ISO 11784/11785`. Es un prerequisito de demo, no un registro de animal seed.
