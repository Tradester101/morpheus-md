/* Configuración de Morpheus MD 2.0 (valores públicos: no poner aquí claves secretas). */
window.NUBE_CONFIG = {
  url: 'https://okorfuqwbkgukqlfugpj.supabase.co',
  key: 'sb_publishable_MPeIjLOaHulRexpMl9mNyA_aveHpTpd', // Publishable key (sb_publishable_…) o anon public de Supabase
  // Precios y datos de pago: PROVISIONALES hasta que Antonio los defina
  precios: { mensual: { usd: 8, txt: '8 USD al mes' }, anual: { usd: 60, txt: '60 USD al año (ahorras 37 %)' } },
  pagos: {
    pago_movil: { t: 'Pago Móvil', datos: 'Banco: por configurar · Teléfono: por configurar · CI/RIF: por configurar', moneda: 'Bs' },
    zelle: { t: 'Zelle', datos: 'Correo: por configurar · Titular: por configurar', moneda: 'USD' },
    binance: { t: 'Binance Pay (USDT)', datos: 'Pay ID: por configurar', moneda: 'USDT' },
  },
  contacto: 'aemart27@gmail.com',
};
