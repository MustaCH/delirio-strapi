/**
 * cliente router
 */

import { factories } from '@strapi/strapi';

// Content API: disabled (customers are managed via checkout + admin)
export default factories.createCoreRouter('api::cliente.cliente', {
  only: [],
});
