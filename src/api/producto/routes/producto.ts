/**
 * producto router
 */

import { factories } from '@strapi/strapi';

// Content API: read-only (admin panel is unaffected)
export default factories.createCoreRouter('api::producto.producto', {
  only: ['find', 'findOne'],
});
