export default ({ env }) => {
  const parseOrigins = (value?: string) =>
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

  const allowedOrigins = Array.from(
    new Set([
      ...parseOrigins(env('FRONTEND_URL')),
      ...parseOrigins(env('PUBLIC_BACKEND_URL')),
    ])
  );

  // NOTE: CORS only affects browsers. Server-to-server calls (e.g. Mercado Pago webhook)
  // typically don't send Origin, so they are unaffected.
  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    {
      name: 'strapi::cors',
      config: {
        // Secure default: if nothing is configured, block cross-origin requests
        origin: allowedOrigins.length > 0 ? allowedOrigins : '',
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Order-Token'],
      },
    },
    'strapi::poweredBy',
    'strapi::session',
    'strapi::query',
    'strapi::body',
    'strapi::favicon',
    'strapi::public',
  ];
};
