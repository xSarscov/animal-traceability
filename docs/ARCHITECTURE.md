# Arquitectura — Animal Traceability MVP v0.1

## Stack aprobado

Frontend: React, Vite, TypeScript, React Router, Tailwind CSS, React Hook Form y Zod. Plataforma: Supabase Auth, PostgreSQL, Row Level Security (RLS) y funciones PostgreSQL expuestas como RPC. Pruebas: Vitest, React Testing Library y Playwright. El despliegue previsto es Vercel para el frontend, Supabase Cloud para backend y GitHub como repositorio.

No habrá API Node/Express propia en v0.1. No introducir Next.js, Redux, Zustand, ORM, microservicios o dependencias equivalentes sin una decisión explícita documentada.

## Decisiones materializadas en M1

- El package manager es npm y el runtime mínimo es Node.js 22.12.
- El frontend es una SPA tradicional de Vite, React y TypeScript; no usa SSR ni React Router Framework Mode.
- El routing usa el paquete `react-router` con `createBrowserRouter` y `RouterProvider`. No se instaló `react-router-dom`, `@react-router/dev`, loaders ni actions de negocio.
- ESLint sustituye al linter del template de Vite. React Compiler no está habilitado.
- Tailwind se integra con el plugin actual `@tailwindcss/vite`; el CSS principal importa `tailwindcss` directamente, sin configuración legacy de PostCSS ni `tailwind.config.js`.
- El repositorio Git está publicado en GitHub y tiene remote configurado. Esta decisión no cambia el flujo de desarrollo local.
- Vitest, React Testing Library, jsdom y Playwright están configurados como infraestructura. M1 solo incluye una prueba de bootstrap, no pruebas de dominio.

## Diagrama lógico

```text
Browser
  | Supabase JS
  v
Supabase
  ├── Auth
  ├── PostgreSQL
  ├── RLS
  └── PostgreSQL functions / RPC
```

CRUD simple puede usar Supabase JS bajo RLS. Toda operación que modifique varias entidades y deba preservar una invariante se implementará como RPC transaccional.

RPC previstas:

- `register_animal_with_chip(...)`
- `mark_animal_lost(...)`
- `mark_animal_found(...)`
- `get_public_animal_by_chip(code)`
- `submit_recovery_report(chip_code, reporter_name, contact, message)`

## Integración HID

El W90D se ha comprobado como USB HID Keyboard: al escanear escribe los dígitos en el foco actual y termina con Enter. La pantalla `/scan` tendrá un `ScannerInput` que procesa `código → Enter → normalize → validate → lookup` y admite las fuentes conceptuales:

```ts
type ScannerSource = 'keyboard-hid' | 'manual'
```

No se usará WebUSB, Web Serial, drivers ni código específico W90D. El código se manipula como texto normalizado —no número— para conservar posibles ceros iniciales. La validación v0.1 es conservadora: string, `trim`, solo dígitos y longitud razonable; no impone 15 dígitos como regla universal del dominio.

Lectores Bluetooth HID futuros deben alimentar el mismo input y las mismas reglas de dominio. La futura app móvil preferirá Bluetooth HID, sin cambios de backend ni acoplamiento a fabricante.

## Supabase, multi-tenancy y privacidad

`auth.users` es la identidad de autenticación; no crear una tabla duplicada `users` sin una necesidad posterior real. Las organizaciones delimitan los datos privados y `organization_members` decide qué usuarios pueden acceder a cada una.

Todas las tablas privadas tendrán RLS. Un miembro solo puede acceder a las organizaciones de las que forma parte. No se permiten políticas abiertas ni SELECT anónimo directo sobre organizaciones, miembros, propietarios, animales, microchips o eventos.

RLS controla el acceso, pero no reemplaza la integridad referencial multi-tenant. En M2 se definirá el mecanismo PostgreSQL efectivo —preferiblemente claves/constraints compuestas cuando resulte apropiado, junto con RPC transaccionales— para impedir que un animal quede referenciando un microchip o propietario de otra organización.

## Base de datos materializada en M2

Supabase CLI se instala como dependencia de desarrollo y el proyecto usa un stack local, sin vincularse ni ejecutar `db push` contra Supabase Cloud. Las migrations versionadas materializan las siete tablas de dominio, sus enums PostgreSQL, timestamps y los índices necesarios. `supabase/seed.sql` contiene exclusivamente datos de demostración reproducibles.

DR-008 se impone mediante FKs compuestas desde `animals` hacia `owners (organization_id, id)` y `microchips (organization_id, id)`, además de la FK del animal hacia su organización. Por tanto, RLS no es el único control que impide referencias cruzadas entre tenants.

La cardinalidad de microchip se impone mediante constraint triggers `DEFERRABLE INITIALLY DEFERRED` en `microchips` y `animals`. Al final de cada transacción validan que `available` y `blocked` tengan cero animales y que `implanted` tenga exactamente uno; la UNIQUE de `animals.microchip_id` sigue impidiendo más de uno. Esto permite a M6 construir una transición coherente dentro de una única transacción sin aceptar estados finales inválidos.

RLS se habilita en todas las tablas privadas desde M2, pero no existen policies hasta M3. pgTAP vive en `supabase/tests/database/`. Tras levantar el stack local, `supabase gen types typescript --local --schema public` genera `src/types/database.types.ts`, que el cliente Supabase tipará como `Database`.

La ruta pública no obtiene tablas directamente. `get_public_animal_by_chip` devuelve solo `chipCode`, `name`, `species`, `breed`, `sex`, `color` y `status`. La creación anónima de un reporte ocurre exclusivamente mediante `submit_recovery_report`, que no concede lectura general de `recovery_reports`.

## Estructura prevista

```text
animal-traceability/
├── src/
│   ├── app/                 # router.tsx, App.tsx
│   ├── components/          # layout y ui
│   ├── features/            # auth, dashboard, scanner, animals, owners,
│   │                        # microchips, events y recovery
│   ├── lib/                 # supabase.ts, env.ts, dates.ts
│   ├── hooks/
│   ├── types/               # database.types.ts
│   └── main.tsx
├── supabase/                # migrations y seed.sql
├── tests/e2e/
├── docs/
├── AGENTS.md
├── .env.example
├── package.json
└── README.md
```

M1 materializa el shell técnico y los archivos de infraestructura necesarios. Los directorios de features y de UI que aún no contienen responsabilidades reales no se rellenan con placeholders; crecerán en su milestone correspondiente.

## Rutas

Privadas: `/login`, `/`, `/scan`, `/animals`, `/animals/new`, `/animals/:animalId`, `/microchips` y `/recovery-reports`.

Pública: `/public/:chipCode`.

No agregar rutas v0.1 innecesarias.

En `/scan`, además de código desconocido, chip disponible y chip implantado, un chip `blocked` muestra “Microchip bloqueado”. Ese resultado no escribe datos, no navega a registro ni ofrece CTA para registrar. No habrá UI para bloquear/desbloquear en v0.1.

## Testing y validación

Vitest y React Testing Library cubrirán lógica y componentes; Playwright cubrirá los flujos de extremo a extremo. Los escenarios finales mínimos son:

- E2E-001: login → escanear chip disponible → registrar animal → perfil.
- E2E-002: escanear chip implantado → perfil.
- E2E-003: reportar perdido → ficha pública muestra perdido.
- E2E-004: usuario público envía reporte → personal ve el reporte.
- E2E-005: anónimo no obtiene PII de propietario.

La automatización no sustituye la prueba manual W90D → USB → navegador real → código → Enter → lookup correcto.

Cada milestone debe terminar con checks aplicables: TypeScript, lint, pruebas relevantes, build, estados loading/empty/error cuando aplique, ausencia de secretos y documentación actualizada.
