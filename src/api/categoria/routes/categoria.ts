/**
 * categoria router
 */

import { factories } from '@strapi/strapi';

// Content API: read-only (admin panel is unaffected)
export default factories.createCoreRouter('api::categoria.categoria', {
  only: ['find', 'findOne'],
});
