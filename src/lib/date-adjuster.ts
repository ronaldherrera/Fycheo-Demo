// src/lib/date-adjuster.ts

// La fecha y hora del último registro conocido en la base de datos de la demo.
const DEMO_END_DATE = new Date('2026-05-29T20:10:00.000Z');

// Offset en milisegundos (para timestamps ISO con precisión)
const now = new Date();
const offset = now.getTime() - DEMO_END_DATE.getTime();

// Offset en días enteros (para campos YYYY-MM-DD, sin decimales)
// Usa fechas locales para que sea estable durante todo el día sin importar la hora
const _demoEndLocal = new Date(DEMO_END_DATE.toDateString());
const _todayLocal   = new Date(now.toDateString());
const DAYS_OFFSET   = Math.round((_todayLocal.getTime() - _demoEndLocal.getTime()) / 86400000);

/**
 * Ajusta una cadena de fecha ISO sumándole el desfase calculado.
 * @param dateString La fecha en formato ISO a ajustar.
 * @returns Una nueva cadena de fecha ISO que es "actual".
 */
const DAY_MS = 86400000;

const adjustISOString = (dateString: string): string | null => {
  try {
    const originalDate = new Date(dateString);
    if (isNaN(originalDate.getTime())) return dateString;
    return new Date(originalDate.getTime() + DAYS_OFFSET * DAY_MS).toISOString();
  } catch (error) {
    console.error("No se pudo ajustar la fecha:", dateString, error);
    return dateString;
  }
};

/**
 * Recorre un objeto o array de forma recursiva y ajusta todas las cadenas
 * de fecha que encuentra a la fecha actual.
 *
 * Esto permite que la demo siempre se sienta "viva" y con datos recientes.
 *
 * @param data El objeto, array o valor a procesar.
 * @returns Los datos con todas las fechas ajustadas.
 */
/**
 * Ajusta una cadena de fecha YYYY-MM-DD sumándole el desfase calculado.
 */
export const adjustDateString = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const result = new Date(y, m - 1, d + DAYS_OFFSET);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
};

/**
 * Convierte una fecha ISO de la UI a la fecha equivalente en la BD
 * restando el desfase. Usar en filtros de consulta a Supabase.
 */
export const deAdjustISOString = (isoStr: string): string => {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return new Date(d.getTime() - DAYS_OFFSET * DAY_MS).toISOString();
};

/**
 * Convierte una fecha YYYY-MM-DD de la UI a la fecha equivalente en la BD.
 * Usar en filtros de consulta a Supabase con campos de fecha sin hora.
 */
export const deAdjustDateString = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const result = new Date(y, m - 1, d - DAYS_OFFSET);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
};

export const adjustDataToCurrentDate = <T>(data: T): T => {
  // Si no hay datos, o no es un objeto, lo devolvemos tal cual
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Si es un array, aplicamos la función a cada elemento
  if (Array.isArray(data)) {
    return data.map(item => adjustDataToCurrentDate(item)) as T;
  }

  // Si es un objeto, recorremos sus propiedades
  const newData = { ...data };
  for (const key in newData) {
    if (Object.prototype.hasOwnProperty.call(newData, key)) {
      const value = newData[key];

      if (typeof value === 'string') {
        // Regex para detectar cadenas que parecen fechas ISO 8601
        // (YYYY-MM-DDTHH:MM:SS)
        const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (isoDatePattern.test(value)) {
          const adjusted = adjustISOString(value);
          if (adjusted) {
            (newData as any)[key] = adjusted;
          }
        }
      } else if (typeof value === 'object') {
        // Si el valor es otro objeto o array, llamamos a la función recursivamente
        (newData as any)[key] = adjustDataToCurrentDate(value);
      }
    }
  }

  return newData;
};
