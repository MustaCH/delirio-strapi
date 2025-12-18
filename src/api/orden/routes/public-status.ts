export default {
  routes: [
    {
      method: 'GET',
      path: '/ordenes/public/:id',
      handler: 'orden.publicStatus',
      config: {
        auth: false,
      },
    },
  ],
};

