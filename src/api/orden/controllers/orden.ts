/**
 * orden controller
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { factories } from '@strapi/strapi';

function asPositiveInt(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(num)) return undefined;
  const int = Math.trunc(num);
  if (int <= 0) return undefined;
  return int;
}

function getQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  return timingSafeEqual(aBuf, bBuf);
}

function generateOrderToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: sha256Hex(token) };
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
        // Strapi v5 expects an array of IDs for relations inside components
        productos: [producto.id],
        quantity: item.quantity,
        unitPrice,
        subtotal,
      };
    });

    const shippingInfo = body.shippingInfo ?? body.shipping ?? undefined;

    const { token: orderToken, tokenHash: publicTokenHash } = generateOrderToken();

    let orden: any;
    try {
      orden = await strapi.db.query('api::orden.orden').create({
        data: {
          cliente: cliente.id,
          orderItems,
          shippingInfo,
          estado: 'pending_payment',
          paymentId: `mp_pref_pending_${Date.now()}`,
          publicTokenHash,
          publishedAt: new Date().toISOString(),
        },
        select: ['id', 'estado', 'paymentId'],
      });
    } catch (err: any) {
      const errorId = randomBytes(8).toString('hex');
      strapi.log.error(`[checkout:${errorId}] Failed to create order`, err);
      ctx.throw(500, `No se pudo crear la orden (errorId=${errorId})`);
    }

    const mp = strapi.service('api::mercadopago.mercadopago');
    let preference: any;
    try {
      preference = await mp.createPreference({
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
    } catch (err: any) {
      const errorId = randomBytes(8).toString('hex');
      strapi.log.error(`[checkout:${errorId}] Mercado Pago createPreference failed`, err);
      ctx.throw(502, `Mercado Pago no pudo crear la preferencia (errorId=${errorId})`);
    }

    await strapi.db.query('api::orden.orden').update({
      where: { id: orden.id },
      data: { paymentId: preference.id },
    });

    ctx.body = {
      orderId: orden.id,
      orderToken,
      preferenceId: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    };
  },

  async publicStatus(ctx) {
    const orderId = asPositiveInt(ctx.params?.id);
    if (!orderId) ctx.throw(400, 'invalid order id');

    const tokenFromHeader = getQueryString((ctx.request as any)?.headers?.['x-order-token']);
    const tokenFromQuery = getQueryString(ctx.query?.token);
    const orderToken = (tokenFromHeader ?? tokenFromQuery)?.trim();

    if (!orderToken) ctx.throw(401, 'order token is required');

    const tokenHash = sha256Hex(orderToken);

    const orden = await strapi.db.query('api::orden.orden').findOne({
      where: { id: orderId },
      select: [
        'id',
        'estado',
        'createdAt',
        'updatedAt',
        'paymentId',
        'publicTokenHash',
        'stockDecrementedAt',
        'stockDecrementFailedAt',
        'stockDecrementError',
      ],
      populate: {
        orderItems: {
          populate: {
            productos: {
              select: ['id', 'name', 'slug'],
            },
          },
        },
        shippingInfo: true,
      },
    });

    if (!orden) ctx.throw(404, 'order not found');

    const storedHash = (orden as any).publicTokenHash as string | undefined;
    if (!storedHash || !safeEqualHex(storedHash, tokenHash)) {
      ctx.throw(403, 'invalid order token');
    }

    const pagos = await strapi.db.query('api::pago.pago').findMany({
      where: { orden: orderId },
      select: ['id', 'paymentId', 'estado', 'type', 'method', 'amount', 'currency', 'creation', 'createdAt'],
      orderBy: { createdAt: 'desc' },
    });

    const responseItems = Array.isArray((orden as any).orderItems)
      ? (orden as any).orderItems.map((item: any) => {
          const productos = Array.isArray(item?.productos) ? item.productos : item?.productos ? [item.productos] : [];
          const producto = productos[0];
          return {
            productId: producto?.id,
            productName: producto?.name,
            productSlug: producto?.slug,
            quantity: item?.quantity,
            unitPrice: item?.unitPrice,
            subtotal: item?.subtotal,
          };
        })
      : [];

    ctx.body = {
      id: orden.id,
      estado: (orden as any).estado,
      createdAt: (orden as any).createdAt,
      updatedAt: (orden as any).updatedAt,
      items: responseItems,
      shippingInfo: (orden as any).shippingInfo ?? null,
      payments: pagos,
      stock: {
        decrementedAt: (orden as any).stockDecrementedAt ?? null,
        failedAt: (orden as any).stockDecrementFailedAt ?? null,
        error: (orden as any).stockDecrementError ?? null,
      },
    };
  },
}));
