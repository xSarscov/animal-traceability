# Animal Traceability

MVP web de identificación y trazabilidad animal mediante microchips RFID y lectores HID.

## Estado

M2 — Base de datos. El schema, seed y pruebas pgTAP se desarrollan contra Supabase local. Auth, policies RLS, RPC y funcionalidades de producto pertenecen a milestones posteriores.

## Requisitos

- Node.js >= 22.12
- npm
- Docker Desktop en ejecución para Supabase local

## Instalación y frontend

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

`.env` solo contiene la URL y publishable key públicas de Supabase; nunca incluir `service_role`, contraseñas ni tokens.

## Base de datos local

```powershell
npm run supabase:start
npm run db:reset
npm run db:test
npm run db:types
```

`db:reset` aplica las migrations y luego carga `supabase/seed.sql`. El seed crea una organización de demostración y deja el chip físico `990000015300168` como `available`, sin animal asociado.

## Checks

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Consulte `docs/` para el producto, arquitectura y reglas de dominio normativas.
