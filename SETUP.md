# Fycheo Demo — Guía de Configuración

Demo de Fycheo con empresa ficticia "Distribuciones Martínez S.A." y 12 meses de historial.

## Paso 1 — Crear un proyecto Supabase dedicado

1. Ve a [supabase.com](https://supabase.com) y crea un **proyecto nuevo** (no uses el de producción).
2. Copia la URL y la anon key del proyecto.

## Paso 2 — Preparar la base de datos

El schema de la demo es idéntico al de producción. Si tienes las migraciones SQL, ejecútalas primero. Si no, asegúrate de tener las tablas:
- `profiles`, `companies`, `company_members`, `teams`
- `shifts`, `time_entries`, `absences`
- `company_holidays`, `activity_logs`, `notifications`

## Paso 3 — Crear los usuarios demo en Supabase

Ve a **Authentication > Users > Invite user** (o Add user) y crea:

| Email                          | Password        |
|-------------------------------|-----------------|
| demo.admin@fycheo-demo.com    | FycheoDemo2024! |
| demo.manager@fycheo-demo.com  | FycheoDemo2024! |
| demo.rrhh@fycheo-demo.com     | FycheoDemo2024! |

> ⚠️ Asegúrate de marcar "Auto Confirm User" o confirma los emails manualmente.

## Paso 4 — Ejecutar los scripts SQL de seed

En el **SQL Editor** de Supabase, ejecuta los scripts en orden:

```
seed/01_demo_users.sql
seed/02_demo_company_and_teams.sql
seed/03_demo_employees.sql
seed/04_demo_shifts_and_entries.sql
seed/05_demo_absences_and_logs.sql
```

Después de ejecutar `02_demo_company_and_teams.sql`, copia el `COMPANY_ID` que aparece en los logs de Supabase.

## Paso 5 — Configurar el .env

```bash
cp .env.example .env
```

Edita `.env` con:
- La URL y anon key de tu proyecto Supabase demo
- El `VITE_DEMO_COMPANY_ID` obtenido en el paso anterior

## Paso 6 — Instalar y ejecutar

```bash
cd Fycheo-Demo
npm install
npm run dev
```

La demo abre en [http://localhost:4000](http://localhost:4000)

## Cuentas demo disponibles

| App / Rol       | Acceso                                    |
|----------------|-------------------------------------------|
| Panel Manager  | Auto-login como admin (Carlos Martínez)   |
| Kiosko         | Auto-login + empresa pre-configurada      |

## Datos incluidos

- **Empresa:** Distribuciones Martínez S.A.
- **Empleados:** 24 personas (4 equipos)
- **Historial:** 12 meses de turnos y fichajes
- **Ausencias:** Vacaciones, bajas médicas, asuntos propios
- **Festivos:** Calendario laboral español
- **Logs:** Registro de actividad del último año

## Notas

- Los empleados ficticios tienen perfiles pero no cuentas de Supabase Auth.
  Solo los 3 usuarios admin/manager/rrhh tienen cuenta real para gestionar.
- El kiosko usa DNI para identificar empleados en la pantalla de fichaje.
- Los datos de fichaje se generan aleatoriamente con patrones realistas.
