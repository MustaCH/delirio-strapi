/**
 * orden controller
 */

import { factories } from '@strapi/strapi';

function asPositiveInt(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(num)) return undefined;
  const int = Math.trunc(num);
  if (int <= 0) return undefined;
  return int;
}

export default factories.createCoreController('api::orden.orden', ({ strapi }) => ({
  async checkout(ctx) {
    const body = (ctx.request as any)?.body ?? {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      ctx.throw(400, 'items is required');
    }

    const normalizedItems = items
      .map((item: any) => ({
        productId: asPositiveInt(item?.productId ?? item?.productoId ?? item?.producto),
        quantity: asPositiveInt(item?.quantity ?? item?.qty),
      }))
      .filter((item: any) => item.productId && item.quantity);

    if (normalizedItems.length === 0) {
      ctx.throw(400, 'items must contain productId and quantity');
    }

    const productIds = Array.from(new Set(normalizedItems.map((i: any) => i.productId)));

    const productos = await strapi.db.query('api::producto.producto').findMany({
      where: { id: { $in: productIds } },
      select: ['id', 'name', 'price', 'stock'],
    });

    const productoPorId = new Map<number, any>();
    for (const p of productos) productoPorId.set(p.id, p);

    for (const item of normalizedItems) {
      const producto = productoPorId.get(item.productId);
      if (!producto) {
        ctx.throw(400, `Producto no encontrado: ${item.productId}`);
      }

      const stock = Number(producto.stock ?? 0);
      if (!Number.isFinite(stock) || stock < item.quantity) {
        ctx.throw(400, `Stock insuficiente para producto ${producto.id}`);
      }
    }

    const clienteId = asPositiveInt(body.clienteId ?? body.cliente?.id);
    let cliente: any;

    if (clienteId) {
      cliente = await strapi.db.query('api::cliente.cliente').findOne({
        where: { id: clienteId },
        select: ['id', 'name', 'lastname', 'email', 'phone'],
      });
      if (!cliente) ctx.throw(400, `Cliente no encontrado: ${clienteId}`);
    } else {
      const clienteBody = body.cliente ?? {};
      const email = String(clienteBody.email ?? '').trim();

      if (!email) ctx.throw(400, 'cliente.email is required');
      if (!clienteBody.name) ctx.throw(400, 'cliente.name is required');
      if (!clienteBody.lastname) ctx.throw(400, 'cliente.lastname is required');
      if (!clienteBody.phone) ctx.throw(400, 'cliente.phone is required');

      cliente = await strapi.db.query('api::cliente.cliente').findOne({
        where: { email },
        select: ['id', 'name', 'lastname', 'email', 'phone'],
      });

      if (cliente?.id) {
        cliente = await strapi.db.query('api::cliente.cliente').update({
          where: { id: cliente.id },
          data: {
            name: clienteBody.name,
            lastname: clienteBody.lastname,
            phone: clienteBody.phone,
          },
          select: ['id', 'name', 'lastname', 'email', 'phone'],
        });
      } else {
        cliente = await strapi.db.query('api::cliente.cliente').create({
          data: {
            name: clienteBody.name,
            lastname: clienteBody.lastname,
            phone: clienteBody.phone,
            email,
            publishedAt: new Date().toISOString(),
          },
          select: ['id', 'name', 'lastname', 'email', 'phone'],
        });
      }
    }

    const orderItems = normalizedItems.map((item: any) => {
      const producto = productoPorId.get(item.productId);
      const unitPrice = Number(producto.price);
      if (!Number.isFinite(unitPrice)) {
        ctx.throw(400, `Precio inválido para producto ${producto.id}`);
      }

      const subtotal = unitPrice * item.quantity;
      return {
        productos: [producto.id],
        quantity: item.quantity,
        unitPrice,
        subtotal,
      };
    });

    const shippingInfo = body.shippingInfo ?? body.shipping ?? undefined;

    const orden = await strapi.db.query('api::orden.orden').create({
      data: {
        cliente: cliente.id,
        orderItems,
        shippingInfo,
        estado: 'pending_payment',
        paymentId: `mp_pref_pending_${Date.now()}`,
        publishedAt: new Date().toISOString(),
      },
      select: ['id', 'estado', 'paymentId'],
    });

    const mp = strapi.service('api::mercadopago.mercadopago');
    const preference = await mp.createPreference({
      orderId: orden.id,
      payer: {
        name: cliente.name,
        surname: cliente.lastname,
        email: cliente.email,
        phone: { number: cliente.phone },
      },
      items: normalizedItems.map((item: any) => {
        const producto = productoPorId.get(item.productId);
        return {
          title: producto.name,
          quantity: item.quantity,
          unitPrice: Number(producto.price),
        };
      }),
    });

    await strapi.db.query('api::orden.orden').update({
      where: { id: orden.id },
      data: { paymentId: preference.id },
    });

    ctx.body = {
      orderId: orden.id,
      preferenceId: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    };
  },
}));

