# Animal Traceability

MVP web para demostrar identificación y trazabilidad animal mediante microchips RFID y lectores HID.

## Estado

M1 — Bootstrap frontend. La base de datos, autenticación y funcionalidades de producto pertenecen a milestones posteriores.

## Requisitos

- Node.js >= 22.12
- npm

## Instalación y configuración

```powershell
npm install
Copy-Item .env.example .env
```

Complete en `.env` los valores públicos de Supabase:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

No agregue secretos, claves `service_role` ni credenciales al frontend.

## Desarrollo

```powershell
npm run dev
```

## Checks

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Consulte `docs/` para las decisiones de producto, arquitectura y dominio.
