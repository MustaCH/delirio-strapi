function getQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function inferNotificationType(input: { type?: unknown; topic?: unknown; action?: unknown }): string | undefined {
  const rawType = (input.type ?? input.topic) as unknown;
  if (typeof rawType === 'string' && rawType) return rawType;

  if (typeof input.action === 'string' && input.action.includes('payment')) return 'payment';

  return undefined;
}

export default ({ strapi }: { strapi: any }) => ({
  async webhook(ctx) {
    const expectedToken = process.env.MERCADOPAGO_WEBHOOK_TOKEN;
    if (expectedToken) {
      const provided = getQueryString(ctx.query?.token);
      if (!provided || provided !== expectedToken) {
        ctx.status = 401;
        ctx.body = { ok: false };
        return;
      }
    }

    const body = (ctx.request as any)?.body ?? {};
    const query = ctx.query ?? {};

    const notificationType = inferNotificationType({
      type: body.type ?? query.type,
      topic: query.topic,
      action: body.action,
    });

    const notificationId =
      String(
        body?.data?.id ??
          body?.id ??
          getQueryString((query as any)['data.id']) ??
          getQueryString(query.id)
      ) || undefined;

    if (!notificationType || !notificationId || notificationId === 'undefined') {
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const mp = strapi.service('api::mercadopago.mercadopago');

    try {
      if (notificationType === 'payment') {
        const payment = await mp.fetchPayment(notificationId);
        await mp.syncPaymentToStrapi(payment);
      } else if (notificationType === 'merchant_order') {
        const merchantOrder = await mp.fetchMerchantOrder(notificationId);
        const payments = Array.isArray(merchantOrder?.payments) ? merchantOrder.payments : [];

        for (const p of payments) {
          const payment = await mp.fetchPayment(String(p.id));
          await mp.syncPaymentToStrapi(payment);
        }
      } else {
        strapi.log.debug?.(`[mercadopago] Ignoring notification type: ${notificationType}`);
      }
    } catch (err: any) {
      strapi.log.error('[mercadopago] Webhook processing failed', err);
      ctx.status = 500;
      ctx.body = { ok: false };
      return;
    }

    ctx.status = 200;
    ctx.body = { ok: true };
  },
});
