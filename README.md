# Animal Traceability

MVP web de identificación y trazabilidad animal mediante microchips RFID y lectores HID.

## Estado

M3 — Auth, multi-tenancy y RLS. El esquema se valida contra Supabase local; la UI se limita a login, rutas privadas y logout. Inventario, escáner y demás funcionalidades de dominio siguen fuera de alcance.

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

## Checks

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Consulte `docs/` para el producto, arquitectura y reglas de dominio normativas.
