// src/lib/date-adjuster.ts
//
// MÓDULO DE IDENTIDAD: ya no desplaza ninguna fecha.
//
// Antes la demo tenía un historial fijo (generado hasta el 4-6-2026) y este módulo
// sumaba o restaba un desfase para que los datos parecieran de hoy. Ahora la semilla
// de producción (demo_seed / demo_reset) regenera cada noche los últimos 12 meses
// relativos a la fecha real, así que no hay nada que desplazar.
//
// Se conserva el módulo, con las mismas funciones exportadas, para no tocar los
// nueve ficheros que lo importan (servicios del manager, kiosko y app del empleado).
// Todas devuelven el valor tal cual; si algún día hace falta volver a desplazar
// fechas, basta con cambiar este fichero.

/** Desfase en días entre los datos y la fecha real. Siempre 0: la semilla ya es relativa a hoy. */
export const DAYS_OFFSET = 0;

/** Timestamp ISO de la base de datos → UI. Identidad. */
export const adjustISOString = (dateString: string): string => dateString;

/** Fecha YYYY-MM-DD de la base de datos → UI. Identidad. */
export const adjustDateString = (dateStr: string): string => dateStr;

/** Timestamp ISO de la UI → filtro de consulta a Supabase. Identidad. */
export const deAdjustISOString = (isoStr: string): string => isoStr;

/** Fecha YYYY-MM-DD de la UI → filtro de consulta a Supabase. Identidad. */
export const deAdjustDateString = (dateStr: string): string => dateStr;

/** Antes recorría el objeto ajustando cada fecha ISO; ahora devuelve los datos sin cambios. */
export const adjustDataToCurrentDate = <T>(data: T): T => data;
