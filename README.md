# Animal Traceability

MVP web de identificación y trazabilidad animal mediante microchips RFID y lectores HID.

## Estado

M5 — Scanner HID. La ruta privada `/scan` recibe códigos mediante un formulario normal: el lector HID y la entrada manual comparten `Enter → normalización → validación → lookup` protegido por RLS. M6 (registro de animales) sigue fuera de alcance.

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

El seed local crea únicamente para demo:

- `admin@animal-traceability.test` / `DemoAdmin123!` con rol `admin`.
- `staff@animal-traceability.test` / `DemoStaff123!` con rol `staff`.

Ambos pertenecen a `Animal Traceability Demo`. Estas credenciales no son secretos ni se deben usar en Supabase Cloud. El chip físico `990000015300168` queda `available`, sin animal asociado.

## Inventario M4

Después de iniciar sesión, abrir `/microchips`. La pantalla ejecuta solo una lectura de `microchips` bajo los grants y RLS de M3; no permite crear, editar, bloquear ni eliminar chips. Los filtros se ejecutan localmente sobre las filas ya autorizadas.

## Scanner HID M5

Después de iniciar sesión, abrir `/scan`. El `ScannerInput` toma el foco automáticamente y acepta tanto el W90D como escritura manual. El código se conserva como texto, se aplica `trim` y se exige un valor numérico de 10–20 dígitos (restricción v0.1, no una regla ISO universal). El lookup hace únicamente `SELECT` exacto de `microchips` y, solo para un chip `implanted`, `SELECT` de su animal asociado; no crea ni modifica datos.

Los resultados son: “Microchip no reconocido”, “Microchip disponible”, “Microchip bloqueado” o navegación prevista a `/animals/:animalId` para uno implantado. M5 no usa WebUSB, Web Serial, Bluetooth, listeners globales ni heurísticas de teclado. La verificación física con W90D está pendiente; consulte `docs/DEMO.md` para el gate obligatorio y el fallback manual.

## Checks

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Consulte `docs/` para el producto, arquitectura y reglas de dominio normativas.
