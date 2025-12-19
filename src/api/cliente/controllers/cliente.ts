/**
 * cliente controller
 */

import { factories } from '@strapi/strapi';

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default factories.createCoreController('api::cliente.cliente', ({ strapi }) => ({
  /**
   * Crea o actualiza un cliente de forma pública (por email).
   * Body esperado: { name, lastname, email, phone }
   */
  async createPublic(ctx) {
    const body = (ctx.request as any)?.body ?? {};

    const name = asNonEmptyString(body.name);
    const lastname = asNonEmptyString(body.lastname);
    const email = asNonEmptyString(body.email)?.toLowerCase();
    const phone = asNonEmptyString(body.phone);

    if (!name) ctx.throw(400, 'name is required');
    if (!lastname) ctx.throw(400, 'lastname is required');
    if (!email) ctx.throw(400, 'email is required');
    if (!phone) ctx.throw(400, 'phone is required');

    let cliente = await strapi.db.query('api::cliente.cliente').findOne({
      where: { email },
      select: ['id', 'name', 'lastname', 'email', 'phone'],
    });

    if (cliente?.id) {
      cliente = await strapi.db.query('api::cliente.cliente').update({
        where: { id: cliente.id },
        data: {
          name,
          lastname,
          phone,
        },
        select: ['id', 'name', 'lastname', 'email', 'phone'],
      });
    } else {
      cliente = await strapi.db.query('api::cliente.cliente').create({
        data: {
          name,
          lastname,
          phone,
          email,
          publishedAt: new Date().toISOString(),
        },
        select: ['id', 'name', 'lastname', 'email', 'phone'],
      });
    }

    ctx.body = {
      id: cliente.id,
      name: cliente.name,
      lastname: cliente.lastname,
      email: cliente.email,
      phone: cliente.phone,
    };
  },

  /**
   * Lista clientes de forma pública (solo para pruebas). Retorna los últimos 50.
   */
  async listPublic(ctx) {
    const clientes = await strapi.db.query('api::cliente.cliente').findMany({
      select: ['id', 'name', 'lastname', 'email', 'phone', 'createdAt', 'updatedAt'],
      orderBy: { createdAt: 'desc' },
      limit: 50,
    });

    ctx.body = { data: clientes };
  },
}));
