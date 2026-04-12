import type { components } from './api.generated';

export type ApiOrderStatus =
  components['schemas']['BulkUpdateOrderStatusRequest']['status'];

export type ApiFulfillmentType =
  components['schemas']['CreatePublicOrderRequest']['fulfillmentType'];

export type ApiCheckoutPaymentMethod =
  components['schemas']['CreatePublicOrderRequest']['paymentMethod'];

// Public branch/shop response DTOs are not yet emitted as named Swagger schemas.
export type ApiBillingTier = 'PG' | 'NON_PG';

export type ApiStorePaymentMethod = Extract<
  ApiCheckoutPaymentMethod,
  'CARD' | 'TRANSFER'
>;
