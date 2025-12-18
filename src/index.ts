// import type { Core } from '@strapi/strapi';

const mask = (value?: string) => {
  if (!value) return 'undefined';
  if (value.length <= 10) return `${value.slice(0, 3)}***`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const mpTokenLabel = (token?: string) => {
  if (!token) return 'missing';
  if (token.startsWith('TEST-')) return 'TEST-*';
  if (token.startsWith('APP_USR-')) return 'APP_USR-* (prod)';
  return 'unknown-format';
};

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;
    strapi.log.info(
      `[mercadopago] Access token: ${mask(accessToken)} (${mpTokenLabel(accessToken)})`
    );
    strapi.log.info(`[mercadopago] Public key: ${mask(publicKey)}`);
  },
};
