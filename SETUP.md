# Fycheo Demo — Puesta en marcha

La demo corre sobre la base de datos de **producción** de Fycheo. No hay que crear ningún proyecto de Supabase ni ejecutar scripts SQL: la empresa ficticia «Distribuciones Martínez S.A.» ya existe allí, marcada con `is_demo`, aislada por RLS y reiniciada automáticamente cada noche.

## Requisitos

- Node.js 20 o superior.
- Acceso al proyecto de producción de Fycheo (paso 1).

## Paso 1 — Pedir acceso

Escribe a [hola@fycheo.es](mailto:hola@fycheo.es) y pide:

1. La URL del proyecto Supabase y su clave `anon`. Es pública por diseño (viaja en el navegador); lo que protege los datos son las políticas RLS, no la clave.
2. La contraseña de la cuenta del administrador demo (`demo.admin@fycheo-demo.com`).
3. Que añadan tu email a la lista de invitados de la demo: la pantalla de entrada lo comprueba.

## Paso 2 — Configurar el `.env`

```bash
cp .env.example .env
```

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de producción |
| `VITE_SUPABASE_ANON_KEY` | Clave `anon` del proyecto de producción |
| `VITE_DEMO_COMPANY_ID` | `dd5bedbe-81f6-466e-921d-06716a0de73d` (id fijo de la empresa demo; ya viene en `.env.example`) |
| `VITE_DEMO_ADMIN_EMAIL` | `demo.admin@fycheo-demo.com` (ya viene en `.env.example`) |
| `VITE_DEMO_ADMIN_PASSWORD` | La contraseña del paso 1. Sin ella la demo muestra un error en vez de intentar el login. |

El `.env` está en `.gitignore`: no lo subas al repositorio.

## Paso 3 — Instalar y ejecutar

```bash
npm install
npm run dev
```

La demo abre en [http://localhost:4000](http://localhost:4000).

## Cómo funciona el acceso

| Pantalla | Qué pasa |
| --- | --- |
| Puerta de entrada (`/`) | Pide un email y lo valida con la RPC `demo_check_access`. Si está invitado, se guarda en el navegador y se registra la visita. |
| Panel Manager | Inicia sesión automáticamente como Carlos Martínez, administrador de la empresa demo. |
| Kiosko | Misma sesión; la empresa y el PIN del dispositivo quedan preconfigurados. El DNI de prueba aparece en pantalla. |
| App del empleado | Muestra la app como la ve Pedro Jiménez, el empleado de pruebas. |

## Datos y reinicio (lo hace el equipo de Fycheo)

No es un paso para quien ejecuta la demo; se documenta para entender el modelo.

- **Crear o recrear la empresa demo:** `select public.demo_seed('<contraseña>');` crea la empresa con `is_demo = true`, las cuentas demo (la contraseña indicada es la que va en `VITE_DEMO_ADMIN_PASSWORD`), 24 empleados en 4 equipos y 12 meses de turnos, fichajes, ausencias y registros de actividad.
- **Reinicio:** `select public.demo_reset();` devuelve la empresa a su estado inicial. Está programado cada noche y puede lanzarse a mano.
- **Lista de invitados y estadísticas de visitas:** se gestionan desde el panel interno de Fycheo (maestro). Esta demo solo escribe en `demo_visits` y `demo_events`; no puede leer ninguna de las dos tablas.

## Qué no hace la demo

- **No crea empresas.** La política RLS lo impide y la empresa ya existe; `/manager/onboarding` solo lo explica y devuelve al panel.
- **No cobra ni envía correos.** Las Edge Functions de pagos (Stripe), correo e invitaciones responden 403 para la empresa demo.
- **Importar empleados por CSV sí funciona:** usa la función de base de datos `demo_add_employee`, que crea el usuario, su perfil y su vínculo con la empresa sin enviar invitaciones.

## Datos incluidos

- **Empresa:** Distribuciones Martínez S.A.
- **Empleados:** 24 personas (4 equipos)
- **Historial:** 12 meses de turnos y fichajes
- **Ausencias:** vacaciones, bajas médicas, asuntos propios
- **Festivos:** calendario laboral español
- **Logs:** registro de actividad del último año

## Notas

- El kiosko identifica a los empleados por DNI en la pantalla de fichaje.
- Las fechas del historial se desplazan al día actual en el cliente (`src/lib/date-adjuster.ts`), respetando el día de la semana.
- Los scripts de `seed/` son los que generaron originalmente la empresa ficticia. Se conservan como referencia del esquema y de los datos; no hace falta ejecutarlos.
