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
    {
      method: 'GET',
      path: '/clientes/public',
      handler: 'cliente.listPublic',
      config: {
        auth: false,
      },
    },
  ],
};
