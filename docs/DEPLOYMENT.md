# Deployment — Animal Traceability MVP v0.1

## Estado M13

**M13 desplegado; smoke hosted read-only PASS.** El proyecto Supabase Cloud `xuxgavoxxeafshmirjpv` recibió las migrations versionadas sin seed; Auth, organización `test-org`, membership e inventario demo fueron configurados administrativamente. Vercel publica `https://animal-traceability-five.vercel.app` con el commit M13.

## Principios no negociables

- Las migrations versionadas son la fuente de verdad. Producción solo recibe cambios forward-only mediante nuevas migrations.
- No ejecutar `supabase db reset --linked`, `supabase db pull` automático ni `supabase db push --include-seed` contra Cloud.
- [`supabase/seed.sql`](../supabase/seed.sql) es exclusivo de local: no copiarlo a SQL Editor ni reutilizar sus usuarios, contraseñas o chip demo en Cloud.
- El frontend recibe únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca usar `service_role`, secretos `sb_secret_*`, contraseñas de base o tokens de CLI en Vercel ni en Git.

## 1. Validación local antes de Cloud

Desde la raíz del proyecto:

```powershell
npm install
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Desde WSL:

```bash
supabase start
supabase db reset
supabase test db --local
supabase db advisors --local --type security --level info
```

`npm run test:e2e` continúa siendo destructivo y exclusivamente local. Ejecutar `db reset` explícitamente antes y después, seguido de `npm run qa:readiness`.

## 2. Seleccionar Supabase Cloud y aplicar schema

Crear o seleccionar manualmente un único proyecto Cloud. Registrar para la operación, no en Git, el ref y host elegidos:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase migration list
supabase db push --dry-run
```

Revisar el dry-run completo. Debe mostrar solamente las migrations existentes bajo `supabase/migrations/` que todavía no estén aplicadas. Si hay discrepancias, detenerse e investigar: no usar `--include-all` ni reparar historia sin entenderla.

Tras la revisión:

```bash
supabase db push
supabase db push --dry-run
supabase gen types typescript --linked --schema public > /tmp/animal-traceability-cloud.types.ts
diff -u src/types/database.types.ts /tmp/animal-traceability-cloud.types.ts
```

No usar `--include-seed`. El segundo dry-run no debe listar migrations pendientes. Si la comparación de tipos muestra un cambio semántico, detener el deploy frontend e investigar; no sobrescribir los tipos generados automáticamente.

En Supabase Dashboard revisar Security Advisor y resolver findings nuevos de RLS, funciones `SECURITY DEFINER`, `search_path`, grants o exposición anónima antes de continuar.

## 3. Auth y bootstrap administrativo

En **Authentication → Providers**, deshabilitar signup público por email. El MVP solo ofrece `signInWithPassword`; los usuarios se aprovisionan administrativamente. Configurar:

- **Site URL:** `https://<VERCEL_PRODUCTION_HOST>/`
- **Redirect URLs:** solo esa URL production exacta.

Crear en Auth Dashboard un usuario inicial real con email controlado y contraseña única y fuerte. No usar los fixtures `*.test` ni contraseñas `Demo*`. Copiar su UUID únicamente para la sesión operativa y ejecutar el siguiente template en SQL Editor, reemplazando todos los placeholders antes de ejecutar:

```sql
begin;

with new_organization as (
  insert into public.organizations (name, slug)
  values ('<ORGANIZATION_NAME>', '<ORGANIZATION_SLUG>')
  returning id
)
insert into public.organization_members (organization_id, user_id, role)
select id, '<AUTH_USER_UUID>'::uuid, 'admin'
from new_organization;

-- Solo si hay un microchip físico aprobado para Cloud:
insert into public.microchips (
  organization_id,
  code,
  technology,
  frequency_khz,
  standard,
  status
)
select
  id,
  '<APPROVED_MICROCHIP_CODE>',
  'FDX-B',
  134.2,
  'ISO 11784/11785',
  'available'
from public.organizations
where slug = '<ORGANIZATION_SLUG>';

commit;
```

La organización, membership e inventario production no pertenecen a migrations ni al seed. No insertar automáticamente `990000015300168`; solo provisionarlo si el operador aprueba explícitamente usar ese chip físico en Cloud, inicialmente `available` y sin animales.

`public.microchips.code` es único: si el código ya existe, el bootstrap debe detenerse y revisarse; no duplicarlo ni sustituirlo silenciosamente.

SMTP, reset de contraseña, onboarding y gestión de empleados no son blockers de M13 porque v0.1 no los implementa. Deben diseñarse antes de habilitar esos flujos.

## 4. Deploy Vercel

Importar el repositorio aprobado desde GitHub o desplegar con Vercel CLI fuera de las dependencias runtime. La configuración esperada es:

- Framework: **Vite**.
- Node: **22.x**.
- Install: `npm install` o `npm ci`.
- Build: `npm run build`.
- Output: `dist`.
- Root: raíz de este repositorio.

En **Vercel → Project Settings → Environment Variables → Production**, configurar solo:

```text
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Ambas variables deben pertenecer al mismo proyecto Cloud. Preview no debe apuntar por defecto al backend production: usar un proyecto staging separado o dejar previews sin backend funcional. No versionar `.vercel/`, `.env`, URL Cloud ni keys.

[`vercel.json`](../vercel.json) reescribe toda ruta a `index.html`, necesario para deep links de React Router como `/scan`, `/public/:chipCode` y `/recovery-reports`.

## 5. Smoke hosted de solo lectura

Después de que Vercel despliegue el commit M13, confirmar que la URL production corresponde a ese commit y ejecutar fuera de Git:

```powershell
$env:DEPLOYMENT_URL = 'https://<VERCEL_PRODUCTION_HOST>'
$env:DEPLOYMENT_STAFF_EMAIL = '<CONTROLLED_STAFF_EMAIL>'
$env:DEPLOYMENT_STAFF_PASSWORD = '<UNIQUE_PASSWORD>'
npm run smoke:production
```

El smoke exige HTTPS no local y no tiene valores por defecto. Verifica deep links directos `/login`, `/scan` y `/public/not-a-chip`; login, dashboard, inventario, scanner, inbox y logout. No registra animales, no inserta eventos o reportes y no cambia ningún estado.

Además, comprobar manualmente con refresh directo que `/scan`, `/public/not-a-chip` y `/recovery-reports` no devuelven 404 de Vercel. La app hosted debe llamar a Supabase Cloud, nunca `localhost`, `127.0.0.1`, `55321` ni `54321`.

## 6. Rollback y política posterior

- **Frontend:** promover o redeplegar el deployment Vercel anterior según la plataforma.
- **Base de datos:** nunca hacer reset remoto. Detener el deploy, investigar y publicar una migration correctiva forward-only.
- **Cambios futuros de DB:** nueva migration → reset/test local → review → `supabase db push --dry-run` → `supabase db push`.

## Evidencia M13

- Project ref: `xuxgavoxxeafshmirjpv` (sin credenciales).
- Migration list, dry-run previo/posterior y `db push` revisados; no se usó `--include-seed` ni `db reset --linked`.
- Tipos remotos equivalentes al contrato local; no se modificó `database.types.ts`.
- Site URL y Redirect URL de Auth apuntan a `https://animal-traceability-five.vercel.app/`; signup público desactivado y Email habilitado para `signInWithPassword`.
- Vercel Production: `https://animal-traceability-five.vercel.app` (commit `17a37d2`), Node `22.x`, variables únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Deep links `/login`, `/scan`, `/public/not-a-chip` y `/recovery-reports` responden mediante la SPA. Smoke hosted read-only: login, dashboard, inventario, scanner, inbox y logout PASS; se observó un primer error transitorio de carga del dashboard y el retry posterior confirmó las cinco métricas.
- Security Advisor Cloud mostró únicamente advertencias esperadas por las RPC `SECURITY DEFINER` intencionalmente expuestas (públicas M9 y autenticadas M6/M8/M10); no se modificó la seguridad para ocultarlas.

## Checklist final

- [x] Project ref Cloud elegido y confirmado por el operador.
- [x] `migration list`, dry-run, push y dry-run posterior revisados.
- [x] Seed local excluido de Cloud; tipos remotos equivalentes y Security Advisor revisado.
- [x] Signup público cerrado; Site URL y Redirect URL production exactos.
- [x] Usuario, organización, membership e inventario Cloud provisionados administrativamente.
- [x] Variables Vercel Production configuradas sin secretos de servidor.
- [x] Deploy Vercel del commit M13 confirmado.
- [x] Deep links y smoke hosted read-only PASS.
