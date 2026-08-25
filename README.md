# Animal Traceability

MVP web de identificación y trazabilidad animal mediante microchips RFID y lectores HID.

## Estado

M10 — Recovery Inbox. La ruta privada `/recovery-reports` permite al personal autorizado consultar los reportes visibles bajo RLS y avanzar exclusivamente `pending → reviewed → closed` mediante RPCs transaccionales. M11 (dashboard) sigue pendiente.

## Requisitos

- Node.js >= 22.12
- npm
- Docker Engine y Docker CLI disponibles desde Ubuntu en WSL para Supabase local

## Instalación y frontend

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

`.env` solo contiene la URL y publishable key públicas de Supabase; nunca incluir `service_role`, contraseñas ni tokens.

## Base de datos local

```bash
supabase start
supabase db reset
supabase test db --local
supabase gen types typescript --local --schema public > src/types/database.types.ts
```

En esta máquina, ejecutar esos comandos desde Ubuntu/WSL para usar Docker CLI sin Docker Desktop. Los scripts npm equivalentes se mantienen para entornos donde la CLI local esté disponible. `db:reset` aplica las migrations y luego carga `supabase/seed.sql`.

Después de un `supabase db reset`, que Docker o PostgreSQL aparezcan `healthy` no demuestra que migrations y seed ya hayan terminado. Antes de abrir el frontend para una demo, esperar el exit 0 del reset y comprobar `to_regclass('public.microchips') IS NOT NULL` y el estado `available` del chip demo. No se usa una espera fija.

El seed local crea únicamente para demo:

- `admin@animal-traceability.test` / `DemoAdmin123!` con rol `admin`.
- `staff@animal-traceability.test` / `DemoStaff123!` con rol `staff`.

Ambos pertenecen a `Animal Traceability Demo`. Estas credenciales no son secretos ni se deben usar en Supabase Cloud. El chip físico `990000015300168` queda `available`, sin animal asociado.

## Inventario M4

Después de iniciar sesión, abrir `/microchips`. La pantalla ejecuta solo una lectura de `microchips` bajo los grants y RLS de M3; no permite crear, editar, bloquear ni eliminar chips. Los filtros se ejecutan localmente sobre las filas ya autorizadas.

## Scanner HID M5

Después de iniciar sesión, abrir `/scan`. El `ScannerInput` toma el foco automáticamente y acepta tanto el W90D como escritura manual. El código se conserva como texto, se aplica `trim` y se exige un valor numérico de 10–20 dígitos (restricción v0.1, no una regla ISO universal). El lookup hace únicamente `SELECT` exacto de `microchips` y, solo para un chip `implanted`, `SELECT` de su animal asociado; no crea ni modifica datos.

Los resultados son: “Microchip no reconocido”, “Microchip disponible”, “Microchip bloqueado” o navegación prevista a `/animals/:animalId` para uno implantado. M5 no usa WebUSB, Web Serial, Bluetooth, listeners globales ni heurísticas de teclado. El gate físico W90D ya obtuvo PASS; consulte `docs/DEMO.md` para su registro y el fallback manual.

## Registro M6

La ruta privada `/animals/new?chip=<code>` realiza un preflight de lectura bajo RLS y solo muestra el formulario para un chip visible `available`. El código no se edita allí. Al enviar, React usa exclusivamente `rpc('register_animal_with_chip', ...)`: no inserta propietarios o animales, no actualiza microchips ni inserta eventos directamente.

La RPC obtiene el usuario desde `auth.uid()`, deriva la organización desde el chip, comprueba membresía y toma un lock `FOR UPDATE`. Dentro de una sola transacción crea o reutiliza el propietario, crea el animal, cambia el chip a `implanted` y agrega los eventos “Animal registrado” y “Microchip implantado” con `performed_by` igual al usuario autenticado. M7 materializa la ficha y timeline privados.

## Perfil y timeline M7

La ruta privada `/animals/:animalId` valida el UUID, consulta primero el animal bajo RLS y solo después consulta su microchip y propietario. La timeline recupera `animal_events` en orden `occurred_at DESC`; el propietario es PII privado y nunca se reutiliza en una ruta pública.

M7 permite únicamente INSERT directo de `vaccination` y `note` sobre `animal_events`. El grant está limitado a `animal_id`, `event_type`, `title`, `description` y `metadata`; PostgreSQL deriva `performed_by` con `auth.uid()` y define los timestamps. No hay UPDATE ni DELETE de eventos.

## Perdido/encontrado M8

M8 usa las RPC `mark_animal_lost` y `mark_animal_found` para cambiar `active → lost` y `lost → active`. Cada RPC bloquea el animal, verifica membership y crea el `status_change` dentro de la misma transacción. El navegador no recibe permiso para actualizar `animals` ni insertar `status_change` directamente.

## Ficha pública y recuperación M9

La ruta pública `/public/:chipCode` está fuera de `RequireAuth` y del shell privado. Solo llama a `get_public_animal_by_chip`, que devuelve código, nombre, especie, raza, sexo, color y estado para un microchip implantado; no consulta ni devuelve propietarios, PII o IDs internos. `unknown`, `available` y `blocked` comparten el mismo resultado de no encontrado.

Cuando el estado público es `lost`, el formulario usa `submit_recovery_report`. Esa RPC valida y normaliza los datos, deriva el animal desde el chip y crea exclusivamente un reporte `pending`. No hay grants ni policies anónimas sobre `recovery_reports`; el visitante tampoco puede leer el reporte creado.

## Recovery Inbox M10

`/recovery-reports` está dentro de `RequireAuth` y del shell privado. Lee reportes bajo la policy RLS existente y carga en lotes los animales y microchips relacionados; la PII del reportante solo se muestra en esa superficie privada. El filtro de estado es local y el orden es `created_at DESC`.

Las transiciones `pending → reviewed` y `reviewed → closed` usan respectivamente `mark_recovery_report_reviewed` y `close_recovery_report`. Ambas RPC son `SECURITY DEFINER`, verifican membership derivada del animal y bloquean el reporte con `FOR UPDATE`. No existe `UPDATE` directo para `authenticated`; `closed` es terminal y las transiciones no cambian el estado del animal ni escriben eventos. M11 será responsable del dashboard.

## Checks

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Consulte `docs/` para el producto, arquitectura y reglas de dominio normativas.
