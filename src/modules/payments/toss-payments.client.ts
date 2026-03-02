import { createHmac, timingSafeEqual } from 'crypto';
import { Logger } from '@nestjs/common';
import { PaymentProvider } from './dto/payment.dto';
import { PaymentProviderException } from '../../common/exceptions/payment.exception';

export interface TossConfirmResponse {
  paymentKey?: string;
  approvedAt?: string;
  [key: string]: unknown;
}

export interface TossRefundResponse {
  [key: string]: unknown;
}

/**
 * Toss Payments HTTP API client.
 *
 * Handles all direct communication with the Toss Payments API including
 * payment confirmation, cancellation/refund, and webhook signature verification.
 * Instantiated by PaymentsService with config values from environment variables.
 */
export class TossPaymentsClient {
  private readonly logger = new Logger(TossPaymentsClient.name);

  constructor(
    private readonly secretKey: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly webhookSecret: string,
    private readonly webhookSignatureHeader: string,
  ) {}

  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<TossConfirmResponse> {
    return this.callApi('/payments/confirm', { paymentKey, orderId, amount });
  }

  async cancelPayment(
    paymentKey: string,
    amount: number,
    reason: string,
  ): Promise<TossRefundResponse> {
    return this.callApi(`/payments/${paymentKey}/cancel`, {
      cancelReason: reason,
      cancelAmount: amount,
    });
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    headers: Record<string, string | string[]>,
  ): boolean {
    if (!this.webhookSecret) return true;

    const headerName = this.webhookSignatureHeader;
    const headerValue =
      headers[headerName] ||
      headers[headerName.toLowerCase()] ||
      headers[headerName.toUpperCase()];

    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!signature) return false;

    const normalized = signature.startsWith('v1=')
      ? signature.slice(3)
      : signature;

    const hmac = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (normalized.length !== hmac.length) return false;

    return timingSafeEqual(
      Buffer.from(normalized, 'utf8'),
      Buffer.from(hmac, 'utf8'),
    );
  }

  private async callApi(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!this.secretKey) {
      throw new PaymentProviderException(
        PaymentProvider.TOSS,
        'Toss Payments secret key is not configured',
      );
    }

    const url = `${this.baseUrl}${path}`;
    const auth = Buffer.from(`${this.secretKey}:`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          (data?.message as string) || `HTTP ${res.status}`,
          data ?? undefined,
        );
      }

      return data ?? {};
    } catch (error: unknown) {
      if (error instanceof PaymentProviderException) {
        throw error;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { name?: string }).name === 'AbortError'
      ) {
        throw new PaymentProviderException(
          PaymentProvider.TOSS,
          'Toss Payments request timed out',
        );
      }
      this.logger.error(`Toss API call failed for path ${path}:`, error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
