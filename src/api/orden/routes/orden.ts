/**
 * orden router
 */

import { factories } from '@strapi/strapi';

// Content API: disabled (orders are created via checkout endpoint)
export default factories.createCoreRouter('api::orden.orden', {
  only: [],
});
