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

RLS controla el acceso, pero no reemplaza la integridad referencial multi-tenant. Desde M2, FKs compuestas impiden que un animal quede referenciando un microchip o propietario de otra organización.

## Base de datos materializada en M2

Supabase CLI se instala como dependencia de desarrollo y el proyecto usa un stack local, sin vincularse ni ejecutar `db push` contra Supabase Cloud. Las migrations versionadas materializan las siete tablas de dominio, sus enums PostgreSQL, timestamps y los índices necesarios. `supabase/seed.sql` contiene exclusivamente datos de demostración reproducibles.

DR-008 se impone mediante FKs compuestas desde `animals` hacia `owners (organization_id, id)` y `microchips (organization_id, id)`, además de la FK del animal hacia su organización. Por tanto, RLS no es el único control que impide referencias cruzadas entre tenants.

La cardinalidad de microchip se impone mediante constraint triggers `DEFERRABLE INITIALLY DEFERRED` en `microchips` y `animals`. Al final de cada transacción validan que `available` y `blocked` tengan cero animales y que `implanted` tenga exactamente uno; la UNIQUE de `animals.microchip_id` sigue impidiendo más de uno. Esto permite a M6 construir una transición coherente dentro de una única transacción sin aceptar estados finales inválidos.

RLS se habilita en todas las tablas privadas desde M2. pgTAP vive en `supabase/tests/database/`. Tras levantar el stack local, `supabase gen types typescript --local --schema public` genera `src/types/database.types.ts`, que el cliente Supabase tipa como `Database`.

## Auth, grants y RLS materializados en M3

M3 usa Supabase Auth con email/password. `AuthProvider` obtiene una sesión con `getSession`, mantiene una única suscripción a `onAuthStateChange` y deja el almacenamiento de JWT al cliente oficial. `/login` es la única pantalla nueva; las rutas privadas documentadas se protegen mediante `RequireAuth`, y el shell autenticado expone solo el email actual y logout. No se implementan consultas ni UI de dominio.

El schema `private` no se expone en `[api].schemas`. Contiene helpers `SECURITY DEFINER`, `STABLE` y con `search_path = pg_catalog, public`: `is_organization_member(organization_id)`, `is_organization_admin(organization_id)` y `can_access_animal(animal_id)`. Cada helper deriva la identidad exclusivamente de `auth.uid()` y consulta tablas con nombres calificados; ningún caller aporta un `user_id` arbitrario. `anon` no tiene `USAGE` ni `EXECUTE`; `authenticated` tiene únicamente lo necesario para evaluar policies.

Los helpers de cardinalidad de M2 ahora son `SECURITY DEFINER` con `search_path` seguro y sus permisos de ejecución directa se revocan para `PUBLIC`, `anon` y `authenticated`. Así los constraint triggers leen el estado completo aunque una policy limite filas al usuario. `set_updated_at` permanece `SECURITY INVOKER`, pues no necesita privilegios ampliados, pero tampoco es ejecutable directamente por roles de aplicación.

En las siete tablas privadas se revocan privilegios de `PUBLIC`, `anon` y `authenticated`; después, solo `authenticated` recibe `SELECT`. No hay grants de escritura ni policies de escritura. Las policies SELECT son: `organizations_select_for_members`, `organization_members_select_self_or_admin`, `owners_select_for_members`, `microchips_select_for_members`, `animals_select_for_members`, `animal_events_select_for_members` y `recovery_reports_select_for_members`. La visibilidad de memberships distingue roles: staff solo ve su propia fila; admin ve todas las memberships de las organizaciones que administra.

La matriz M3 es: `anon` no tiene acceso directo a ninguna tabla privada; `authenticated` miembro lee organizaciones, propietarios, microchips y animales de sus organizaciones, y eventos/reportes derivados de esos animales; todos los writes directos están denegados. Un admin solo gana visibilidad adicional sobre memberships de su organización, no escrituras administrativas. Operaciones de escritura llegarán únicamente en su milestone y mediante el mecanismo previsto.

El seed local crea los usuarios reproducibles `admin@animal-traceability.test` / `DemoAdmin123!` y `staff@animal-traceability.test` / `DemoStaff123!`, ambos miembros de `Animal Traceability Demo`. Son credenciales exclusivas de desarrollo local, no credenciales Cloud. Las pruebas pgTAP de M3 ejecutan requests simulados como admin/staff de dos organizaciones y como `anon`, además de comprobar grants, RLS, helpers y el hardening de funciones.

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
