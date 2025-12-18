export default {
  routes: [
    {
      method: 'POST',
      path: '/mercadopago/webhook',
      handler: 'mercadopago.webhook',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/mercadopago/webhook',
      handler: 'mercadopago.webhook',
      config: {
        auth: false,
      },
    },
  ],
};

