# QA — Animal Traceability MVP v0.1

## Estado M12

**PASS (local).** Se ejecutaron los checks frontend, las 272 pruebas pgTAP, advisors de seguridad, readiness HTTP, el flujo Playwright completo y el reset final con baseline `0 / 1 / 0 / 0 / 0`. M12 no agrega producto, schema, RLS, grants ni RPCs: convierte el flujo existente en un gate reproducible.

## Precondiciones y readiness

Los E2E son destructivos: registran Luna con el chip demo `990000015300168`, crean eventos, cambian el estado del animal y crean/cierra un reporte. Se ejecutan exclusivamente contra Supabase local.

Desde Ubuntu/WSL:

```bash
supabase start
supabase db reset
```

Esperar el exit `0` de `db reset`, no solo contenedores `healthy`. Luego, desde la raíz del frontend:

```powershell
npm run qa:readiness
```

El script carga `.env` y `.env.local` con la precedencia de Vite y rechaza una URL cuyo hostname no sea `127.0.0.1` o `localhost`. No usa `service_role`, no imprime la publishable key y prueba condiciones reales:

1. Health HTTP de Auth.
2. Login local de staff, sin persistir sesión.
3. Consulta autenticada de PostgREST/RLS al chip demo `available`.
4. Baseline limpio `0 / 1 / 0 / 0 / 0`.
5. RPC pública anónima disponible y sin ficha para ese chip todavía `available`.

El gate exige varias rondas consecutivas de esas condiciones completas. No reemplaza la comprobación con un `sleep`: cada ronda vuelve a usar Auth, PostgREST/RLS, el baseline y la RPC anónima.

Si las APIs responden pero el baseline no coincide, el script falla de inmediato: ejecutar `supabase db reset` antes de continuar.

## Comandos

```powershell
npm install
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run qa:readiness
npm run test:e2e
```

En WSL, además:

```bash
supabase test db --local
supabase db advisors --local --type security --level info
```

`npm run test:e2e` ejecuta primero `qa:readiness`. Playwright usa Chromium, un único worker y `retries: 0`: un reintento automático sería inválido después de convertir el chip demo de `available` a `implanted`. Ante un fallo después de iniciar el flujo: `supabase db reset` → esperar exit `0` → `npm run qa:readiness` → `npm run test:e2e`.

Las trazas y screenshots se conservan solo cuando falla una prueba. `playwright-report/` y `test-results/` permanecen ignorados por Git.

## Matriz de cobertura

| Ruta / área | Vitest / RTL | pgTAP | Playwright | Manual |
| --- | --- | --- | --- | --- |
| `/login` y rutas privadas | Auth, router y shell | Grants/RLS Auth | Guard, login y logout | — |
| `/` dashboard | Data access, loading/error/retry/cero | RLS existente | Baseline y métricas tras cada transición | — |
| `/scan` | Validación, estados y lookup | RLS de microchips/animals | Entrada manual + Enter y re-scan | W90D HID M5 PASS |
| `/microchips` | Loading, global/filter empty, error | RLS microchips | Regresión de rutas; no es write | — |
| `/animals/new?chip=…` | Preflight, form, RPC payload y success | Atomicidad/rollback M6 | Registro de Luna | — |
| `/animals/:animalId` | Loading/not-found/error, timeline, vacuna, nota, status | Eventos y RPCs M7/M8 | Perfil, PII privada, vacuna, nota, lost/found | — |
| `/public/:chipCode` | Loading/not-found/error, safe contract, report form | Anon, no PII, RPC M9 | Contexto sin sesión, no PII, reporte | — |
| `/recovery-reports` | Loading/empty/filter/error/transiciones | RLS y RPCs M10 | Pending → reviewed → closed | — |

La cobertura de estados loading/empty/error permanece principalmente en RTL, donde se pueden provocar de forma controlada sin contaminar el fixture estatal del E2E.

## Flujo automatizado M5–M11

El único test E2E realiza: guard privado → login staff → baseline dashboard → scanner con entrada manual/Enter → registro de Luna con canarios de PII → perfil privado → vacuna → nota → perdido → re-scan → dashboard → contexto anónimo independiente → ficha pública sin PII → reporte `pending` → inbox `reviewed` → animal encontrado → inbox `closed` → dashboard final → logout.

Playwright no reemplaza el gate físico W90D. Ese gate continúa siendo una prueba manual histórica independiente (`PASS`); la automatización usa escritura manual en el mismo `ScannerInput`.

La prueba también falla ante `pageerror` o respuestas HTTP 4xx/5xx inesperadas de Auth/PostgREST en el happy path.

## Seguridad y límites aceptados

- pgTAP verifica la frontera de RLS, grants, RPCs y anonimato; el E2E verifica en el mismo navegador que la PII canario existe privada y no aparece públicamente.
- No hay reset productivo, `service_role` ni ejecución contra Cloud. La limpieza siempre es `supabase db reset` explícito desde WSL.
- No hay reintentos, paralelismo, realtime ni polling de producto.
- El warning de bundle superior a 500 kB, si Vite lo emite, es conocido y no bloqueante; M12 no introduce code splitting fuera de alcance.

## Reset final

Después del E2E:

```bash
supabase db reset
```

Esperar exit `0` y ejecutar `npm run qa:readiness`. El resultado debe volver a confirmar `0 / 1 / 0 / 0 / 0`: chip `990000015300168` `available`, `animal_count = 0` y `recovery_report_count = 0`.
