export default {
  routes: [
    {
      method: 'POST',
      path: '/ordenes/checkout',
      handler: 'orden.checkout',
      config: {
        auth: false,
      },
    },
  ],
};

