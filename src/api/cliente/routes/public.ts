export default {
  routes: [
    {
      method: 'POST',
      path: '/clientes/public',
      handler: 'cliente.createPublic',
      config: {
        auth: false,
      },
    },
  ],
};

