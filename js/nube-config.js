/* Configuración de Morpheus MD 2.0 (valores públicos: no poner aquí claves secretas). */
window.NUBE_CONFIG = {
  url: 'https://okorfuqwbkgukqlfugpj.supabase.co',
  key: 'sb_publishable_MPeIjLOaHulRexpMl9mNyA_aveHpTpd', // Publishable key (sb_publishable_…) o anon public de Supabase
  // Valores de respaldo. Los vigentes los define el administrador en la app (Administración › Precios y cobro) y se guardan en Supabase.
  // usd = pago en divisas (Zelle, USDT); bcv = pago en bolívares, en USD a la tasa BCV del día.
  precios: { mensual: { usd: 8, bcv: 9.5 }, anual: { usd: 60, bcv: 68 } },
  pagos: {
    pago_movil: { t: 'Pago Móvil', datos: 'Banco: por configurar · Teléfono: por configurar · CI/RIF: por configurar', moneda: 'Bs' },
    zelle: { t: 'Zelle', datos: 'Correo: por configurar · Titular: por configurar', moneda: 'USD' },
    binance: { t: 'Binance Pay (USDT)', datos: 'Pay ID: por configurar', moneda: 'USDT' },
  },
  web: 'https://morpheus-md.com/',
  correos: { contacto: 'contacto@morpheus-md.com', soporte: 'soporte@morpheus-md.com', pagos: 'pagos@morpheus-md.com' },
  contacto: 'pagos@morpheus-md.com', // dudas de pago (respaldo; se edita en Administración › Precios y cobro)
};
