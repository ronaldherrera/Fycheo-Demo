/**
 * Etiquetas legibles para `companies.plan`.
 *
 * En producción el plan Pro se guarda por tramo de empleados
 * (pro15, pro30, pro60, pro100); la empresa demo usa 'pro30'.
 * Ninguna de estas funciones lanza: una clave desconocida se muestra tal cual.
 */

const PRO_TIER = /^pro(\d+)$/;

const FIXED_LABELS: Record<string, string> = {
  free:       'Gratuito / Sin plan',
  basic:      'Básico',
  pro:        'Pro',
  ultimate:   'Ultimate',
  enterprise: 'Enterprise',
};

/** Familia del plan, para compararla con las tarjetas de Account ('pro30' → 'pro'). */
export function planFamily(plan: string | null | undefined): string {
  if (!plan) return 'free';
  const key = String(plan).toLowerCase();
  return PRO_TIER.test(key) ? 'pro' : key;
}

/** Etiqueta para mostrar. Con `withLimit`, los tramos Pro incluyen el tope de empleados. */
export function planLabel(plan: string | null | undefined, opts: { withLimit?: boolean } = {}): string {
  if (!plan) return FIXED_LABELS.free;
  const key = String(plan).toLowerCase();
  const tier = key.match(PRO_TIER);
  if (tier) return opts.withLimit ? `Pro · hasta ${tier[1]} empleados` : 'Pro';
  return FIXED_LABELS[key] ?? String(plan);
}
