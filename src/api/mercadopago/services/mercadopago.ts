type MercadoPagoPreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
};

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  external_reference?: string;
  metadata?: Record<string, unknown>;
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_created?: string;
  date_last_updated?: string;
};

type MercadoPagoMerchantOrder = {
  id: number | string;
  external_reference?: string;
  preference_id?: string;
  payments?: Array<{ id: number | string }>;
};

const MP_API_BASE = 'https://api.mercadopago.com';

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return String(value).trim() || undefined;
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildNotificationUrl(): string | undefined {
  const explicit = getEnv('MERCADOPAGO_NOTIFICATION_URL');
  if (explicit) return explicit;

  const base = getEnv('PUBLIC_BACKEND_URL');
  if (!base) return undefined;

  const url = new URL('/api/mercadopago/webhook', base);
  const token = getEnv('MERCADOPAGO_WEBHOOK_TOKEN');
  if (token) url.searchParams.set('token', token);

  return url.toString();
}

function buildBackUrls(): { success: string; failure: string; pending: string } | undefined {
  const frontendUrl = getEnv('FRONTEND_URL');
  if (!frontendUrl) return undefined;

  const base = frontendUrl.replace(/\/+$/, '');
  return {
    success: `${base}/checkout/success`,
    failure: `${base}/checkout/failure`,
    pending: `${base}/checkout/pending`,
  };
}

async function mpRequest<T>({
  path,
  method,
  body,
}: {
  path: string;
  method: 'GET' | 'POST';
  body?: unknown;
}): Promise<T> {
  const accessToken = requireEnv('MERCADOPAGO_ACCESS_TOKEN');

  const res = await fetch(`${MP_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = undefined;
    }
  }

  if (!res.ok) {
    const message =
      (json as any)?.message ??
      (json as any)?.error ??
      (json as any)?.error_message ??
      text ??
      `Mercado Pago API error (${res.status})`;
    throw new Error(message);
  }

  return json as T;
}

function mapPaymentToPagoEstado(status?: string): 'pending' | 'approved' | 'rejected' | 'refunded' {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    case 'rejected':
    case 'cancelled':
      return 'rejected';
    default:
      return 'pending';
  }
}

function mapPaymentToOrdenEstado(
  status?: string
):
  | 'pending_payment'
  | 'payment_processing'
  | 'paid'
  | 'refounded'
  | 'canceled' {
  switch (status) {
    case 'approved':
      return 'paid';
    case 'refunded':
    case 'charged_back':
      return 'refounded';
    case 'rejected':
    case 'cancelled':
      return 'canceled';
    default:
      return 'payment_processing';
  }
}

function resolveOrderIdFromPayment(payment: MercadoPagoPayment): number | undefined {
  const externalReference = payment.external_reference;
  if (externalReference) {
    const asNumber = Number(externalReference);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  }

  const maybeFromMetadata = (payment.metadata as any)?.order_id ?? (payment.metadata as any)?.orderId;
  if (maybeFromMetadata !== undefined && maybeFromMetadata !== null) {
    const asNumber = Number(maybeFromMetadata);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  }

  return undefined;
}

export default ({ strapi }: { strapi: any }) => ({
  buildNotificationUrl,

  async createPreference(params: {
    orderId: number;
    payer?: {
      name?: string;
      surname?: string;
      email?: string;
      phone?: { number?: string };
    };
    items: Array<{ title: string; quantity: number; unitPrice: number }>;
  }): Promise<MercadoPagoPreferenceResponse> {
    const currencyId = getEnv('MERCADOPAGO_CURRENCY') ?? 'ARS';

    const items: MercadoPagoPreferenceItem[] = params.items.map((item) => ({
      title: item.title,
      quantity: Math.max(1, Math.trunc(item.quantity)),
      unit_price: roundMoney(item.unitPrice),
      currency_id: currencyId,
    }));

    const payload: any = {
      items,
      external_reference: String(params.orderId),
      metadata: {
        order_id: params.orderId,
      },
    };

    const notificationUrl = buildNotificationUrl();
    if (notificationUrl) payload.notification_url = notificationUrl;

    const backUrls = buildBackUrls();
    if (backUrls) {
      payload.back_urls = backUrls;
      payload.auto_return = 'approved';
    }

    if (params.payer) payload.payer = params.payer;

    return mpRequest<MercadoPagoPreferenceResponse>({
      method: 'POST',
      path: '/checkout/preferences',
      body: payload,
    });
  },

  async fetchPayment(paymentId: string): Promise<MercadoPagoPayment> {
    return mpRequest<MercadoPagoPayment>({
      method: 'GET',
      path: `/v1/payments/${encodeURIComponent(paymentId)}`,
    });
  },

  async fetchMerchantOrder(merchantOrderId: string): Promise<MercadoPagoMerchantOrder> {
    return mpRequest<MercadoPagoMerchantOrder>({
      method: 'GET',
      path: `/merchant_orders/${encodeURIComponent(merchantOrderId)}`,
    });
  },

  async syncPaymentToStrapi(payment: MercadoPagoPayment): Promise<{
    orderId?: number;
    pagoId?: number;
    ordenEstado?: string;
    pagoEstado?: string;
  }> {
    const orderId = resolveOrderIdFromPayment(payment);
    if (!orderId) {
      return {};
    }

    const pagoEstado = mapPaymentToPagoEstado(payment.status);
    const ordenEstado = mapPaymentToOrdenEstado(payment.status);

    const paymentId = String(payment.id);
    const method =
      payment.payment_method_id ??
      payment.payment_type_id ??
      'unknown';

    const existingPago = await strapi.db.query('api::pago.pago').findOne({
      where: { paymentId },
      select: ['id'],
    });

    if (existingPago?.id) {
      await strapi.db.query('api::pago.pago').update({
        where: { id: existingPago.id },
        data: {
          estado: pagoEstado,
          method,
          amount: payment.transaction_amount,
          currency: payment.currency_id,
          rawResponse: payment as any,
          update: payment.date_last_updated,
        },
      });
    } else {
      const created = await strapi.db.query('api::pago.pago').create({
        data: {
          orden: orderId,
          paymentId,
          type: 'checkout',
          method,
          estado: pagoEstado,
          amount: payment.transaction_amount,
          currency: payment.currency_id,
          rawResponse: payment as any,
          creation: payment.date_created,
          update: payment.date_last_updated,
          publishedAt: new Date().toISOString(),
        },
        select: ['id'],
      });
      (existingPago as any) = created;
    }

    await strapi.db.query('api::orden.orden').update({
      where: { id: orderId },
      data: {
        estado: ordenEstado,
        paymentId,
      },
    });

    return {
      orderId,
      pagoId: (existingPago as any)?.id,
      ordenEstado,
      pagoEstado,
    };
  },
});
