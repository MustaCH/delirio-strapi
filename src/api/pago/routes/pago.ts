/**
 * pago router
 */

import { factories } from '@strapi/strapi';

// Content API: disabled (payments are created/updated via Mercado Pago webhook)
export default factories.createCoreRouter('api::pago.pago', {
  only: [],
});
