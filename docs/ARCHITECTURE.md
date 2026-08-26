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

## Integración HID materializada en M5

El W90D se ha comprobado como USB HID Keyboard: al escanear escribe los dígitos en el foco actual y termina con Enter. La ruta privada `/scan` materializa un `ScannerInput` dentro de un formulario HTML normal: `código → submit por Enter → normalize → validate → lookup`. El mismo input admite entrada manual y un lector HID; la aplicación no intenta inferir la fuente.

```ts
type ScannerSource = 'keyboard-hid' | 'manual'
```

No se usan WebUSB, Web Serial, Bluetooth, listeners globales de teclado, timing heuristics, drivers ni código específico W90D. El código se manipula como texto normalizado —no número— para conservar posibles ceros iniciales. La validación v0.1 es conservadora: `trim`, solo dígitos y 10–20 caracteres; no impone 15 dígitos como regla universal del dominio ni pretende caracterizar todos los formatos ISO 11784/11785.

El lookup es solo lectura y realiza primero `microchips` por igualdad exacta de `code`, con `id`, `code` y `status`; solo si el estado es `implanted` consulta `animals` por `microchip_id` y recupera `id`. Nunca envía `organization_id`: los grants y RLS de M3 definen las filas visibles. Un chip inexistente o no visible por otro tenant se presenta como “Microchip no reconocido”, evitando revelar inventario ajeno. Los resultados son `unknown`, `available`, `blocked` e `implanted`; el último navega hacia la futura ruta `/animals/:animalId`, y `available` enlaza al registro M6. El escaneo no realiza writes (DR-005).

## Registro transaccional materializado en M6

`/animals/new?chip=<code>` valida el parámetro reutilizando la normalización y validación de M5, realiza un preflight `SELECT` bajo RLS y solo muestra el formulario si el microchip visible continúa `available`. La lista opcional de propietarios usa el `organization_id` derivado del chip únicamente como filtro UX; RLS y la RPC siguen siendo la frontera de autorización.

La única escritura del frontend es `supabase.rpc('register_animal_with_chip', ...)`. La función `public.register_animal_with_chip` es `SECURITY DEFINER`, usa `search_path = pg_catalog, public`, deriva caller con `auth.uid()` y resuelve la organización a partir del microchip. Verifica membresía explícitamente y toma `SELECT ... FOR UPDATE` sobre el chip antes de comprobar `available`, de modo que una carrera entre preflight y submit no puede producir dos registros.

En una transacción de PostgreSQL, la función resuelve un propietario existente de la misma organización o crea uno nuevo, inserta el animal con las FKs compuestas de DR-008, cambia el chip a `implanted` e inserta los eventos `registration` (“Animal registrado”) e `implantation` (“Microchip implantado”). Ambos eventos usan `performed_by = auth.uid()`. Ante cualquier fallo, la llamada revierte completa; no existen grants ni policies de escritura directa para las tablas de dominio. `anon` no puede ejecutar la función y `authenticated` recibe únicamente `EXECUTE` sobre esa firma.

Lectores Bluetooth HID futuros deben alimentar el mismo input y las mismas reglas de dominio. La futura app móvil preferirá Bluetooth HID, sin cambios de backend ni acoplamiento a fabricante.

## Perfil privado y timeline materializados en M7

`/animals/:animalId` valida el UUID antes de consultar. Bajo RLS obtiene el animal por ID y, solo si es visible, consulta su microchip y propietario privado. La timeline usa `SELECT id, event_type, title, description, metadata, occurred_at FROM animal_events WHERE animal_id = ... ORDER BY occurred_at DESC`. Un ID inexistente o de otra organización produce el mismo resultado privado: “Animal no encontrado”.

M7 materializa el primer write directo simple bajo RLS: `INSERT` sobre `animal_events`, coherente con la arquitectura aprobada porque es una sola fila y no modifica invariantes multi-entidad. El grant es por columnas (`animal_id`, `event_type`, `title`, `description`, `metadata`) y la policy `animal_events_insert_vaccination_or_note_for_members` exige miembro del animal, `event_type IN ('vaccination', 'note')` y `performed_by = auth.uid()` tras aplicar el default de PostgreSQL. La UI nunca envía campos auditables; `occurred_at` y `created_at` usan defaults del servidor. UPDATE y DELETE siguen sin grants ni policies.

La vacunación se guarda como `animal_events.metadata` JSONB y se interpreta mediante validación segura en la timeline. No se crean tablas clínicas ni RPCs genéricas de eventos. M8 mantiene la responsabilidad exclusiva de `status_change` y lost/found.

## Perdido/encontrado transaccional materializado en M8

M8 implementa `public.mark_animal_lost(p_animal_id uuid)` y `public.mark_animal_found(p_animal_id uuid)`. Ambas RPC son `SECURITY DEFINER`, fijan `search_path = pg_catalog, public`, obtienen el caller con `auth.uid()` y verifican membresía explícita contra la organización derivada del animal. No aceptan organización, usuario, estado, evento ni timestamp desde React.

Cada función adquiere `SELECT ... FOR UPDATE` sobre el animal, reevalúa el estado tras el lock y solo permite `active → lost` o `lost → active`, respectivamente. Dentro de la misma transacción actualiza `animals.status` e inserta el `status_change` con título y `performed_by` definidos en PostgreSQL. Ante un fallo, incluidos los de inserción del evento, PostgreSQL revierte también el cambio de estado. `authenticated` conserva sin grant/policy de `UPDATE` sobre `animals`, y M7 no se amplía: la inserción directa sigue limitada a `vaccination` y `note`.

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

## Inventario de microchips materializado en M4

`/microchips` es una ruta privada dentro de `RequireAuth`. La feature realiza una sola lectura inicial con el cliente Supabase existente: `SELECT code, technology, frequency_khz, standard, batch_code, status FROM microchips ORDER BY code ASC`. No envía `organization_id`, no realiza joins y no tiene `INSERT`, `UPDATE`, `DELETE`, RPC ni permisos adicionales; los grants y RLS de M3 deciden la colección antes de que llegue al navegador.

La búsqueda parcial por código y el filtro de estado se aplican localmente sobre esa colección autorizada, mediante estado local y una lista visible derivada. Esto es suficiente para el inventario pequeño del MVP y evita una request por pulsación. Si el inventario supera esta escala, un milestone futuro podrá introducir paginación server-side sin convertir el filtro de cliente en mecanismo de autorización.

La pantalla distingue loading, inventario vacío, filtros sin coincidencias y error con retry de la misma lectura. No implementa captura HID ni lookup de escaneo; ambos se incorporan por separado en M5.

## Superficie pública segura materializada en M9

`/public/:chipCode` se renderiza fuera de `RequireAuth` y de `AppShell`. Su feature solo usa RPC: no contiene consultas directas a `animals`, `microchips`, `owners` ni `recovery_reports`. `get_public_animal_by_chip(text)` es `STABLE SECURITY DEFINER`, fija `search_path = pg_catalog, public` y retorna exactamente `chip_code`, `name`, `species`, `breed`, `sex`, `color` y `status`; consulta únicamente `microchips` y `animals`. Solo hay resultado para un chip `implanted` con animal asociado. Los demás casos públicos son indistinguibles y devuelven cero filas.

`submit_recovery_report(text, text, text, text)` también es `SECURITY DEFINER` con el mismo `search_path`. Normaliza y limita el input, deriva el animal desde el chip y acepta solo un animal `lost`. Obtiene `FOR SHARE OF animal` antes del INSERT para coordinarse con el `FOR UPDATE` de M8: si `found` gana la carrera, el reporte se rechaza de forma segura. Inserta exclusivamente `pending`; no recibe animal, organización, propietario, estado ni timestamps del navegador.

Ambas funciones revocan ejecución de `PUBLIC` y conceden `EXECUTE` explícito a `anon` y `authenticated`. M9 no concede grants de tabla ni policies anónimas: `anon` sigue sin `SELECT` directo sobre tablas privadas ni `INSERT` sobre `recovery_reports`.

## Recovery Inbox M10

`/recovery-reports` vive dentro de `RequireAuth` y `AppShell`. Su lectura continúa siendo CRUD simple bajo la policy `recovery_reports_select_for_members`: recupera los reportes visibles ordenados por `created_at DESC`, y resuelve animales y microchips relacionados en dos lecturas batch adicionales. No hay RPC de lectura, paginación ni realtime; el filtro local solo opera sobre filas ya autorizadas. Los datos del reportante se muestran exclusivamente en esta ruta privada.

Las transiciones de la máquina de estados usan `mark_recovery_report_reviewed(uuid)` (`pending → reviewed`) y `close_recovery_report(uuid)` (`reviewed → closed`). Ambas funciones son `SECURITY DEFINER`, fijan `search_path = pg_catalog, public`, obtienen el caller con `auth.uid()`, derivan la organización desde `report → animal`, comprueban membership explícita y bloquean la fila de `recovery_reports` con `FOR UPDATE`. Revocan ejecución a `PUBLIC` y `anon`, y la conceden únicamente a `authenticated`. No se concede `UPDATE` directo ni se crea policy de actualización. `closed` es terminal; revisar o cerrar no cambia `animals.status`, no altera microchips ni agrega eventos.

## Dashboard simple M11

La ruta privada `/` materializa el dashboard dentro de `RequireAuth` y `AppShell`. Su capa de datos inicia en paralelo cinco lecturas directas bajo los grants y policies RLS existentes: `animals` total, `microchips` con `available`, `microchips` con `implanted`, `animals` con `lost` y `recovery_reports` con `pending`. Cada una usa `SELECT id` con `count: 'exact'` y `head: true`, por lo que no transfiere filas completas ni recibe `organization_id` desde el navegador. RLS define exactamente el universo agregado, incluso para una sesión con varias organizaciones autorizadas.

No hay migration, RPC, grants, policies, joins, realtime, polling ni gráficos. Las cinco respuestas son un resumen operacional eventualmente consistente entre requests; M11 no introduce un agregador transaccional. Cero es un count válido; un error o count nulo en cualquiera de las cinco lecturas invalida el resumen completo y habilita retry. El CTA del dashboard navega a `/scan`.

## QA/E2E M12

M12 no cambia la arquitectura de dominio. El gate local `scripts/check-local-readiness.mjs` carga las mismas variables Vite del frontend, acepta solo `127.0.0.1`/`localhost` y verifica por HTTP Auth, un JWT de staff utilizable por PostgREST/RLS, la RPC pública anónima y el baseline de demo limpio antes de permitir E2E destructivos.

Playwright ejecuta un único flujo Chromium estatal sobre el fixture local: `workers = 1`, `retries = 0`, trazas y screenshots solo de fallo. No realiza reset, no usa `service_role` y no puede apuntar a Cloud. La restauración posterior es un `supabase db reset` explícito. Esta automatización recorre la integración M5–M11 con entrada manual en el formulario del scanner; no sustituye el gate físico W90D ya validado por separado.

## Deployment M13

M13 prepara una SPA estática Vite en Vercel: [`vercel.json`](../vercel.json) reescribe las rutas a `index.html` para que `createBrowserRouter` resuelva deep links. Vercel recibe exclusivamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del mismo proyecto Supabase Cloud; no recibe service role ni credenciales de base.

Supabase Cloud recibe las migrations existentes mediante `db push` revisado con dry-run, sin seed. El bootstrap de Auth, organización, membership e inventario es administrativo y no está en Git. El smoke M13 es separado del demo M12: requiere URL HTTPS y credenciales controladas, verifica solo lectura/deep links/login/logout y no puede ejecutar writes. El proyecto `xuxgavoxxeafshmirjpv` está desplegado en Vercel como `https://animal-traceability-five.vercel.app`; la validación hosted read-only fue ejecutada sin modificar datos.

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
