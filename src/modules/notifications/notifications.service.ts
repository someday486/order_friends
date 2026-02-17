import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationType,
  NotificationStatus,
  NotificationResult,
  OrderConfirmationEmailData,
  OrderStatusUpdateEmailData,
  PaymentConfirmationEmailData,
  RefundConfirmationEmailData,
  LowStockAlertEmailData,
  OrderConfirmationSMSData,
  OrderReadySMSData,
  DeliveryCompleteSMSData,
  EmailTemplate,
} from './dto/notification.dto';

type EmailPayload = {
  kind: 'EMAIL';
  subject: string;
  html: string;
  text?: string;
};

type SmsPayload = {
  kind: 'SMS';
  message: string;
};

type KakaoPayload = {
  kind: 'KAKAO_TALK';
  message: string;
  templateCode?: string;
};

type NotificationPayload = EmailPayload | SmsPayload | KakaoPayload;

type NotificationStatusView = {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  recipient: string;
  retryCount: number;
  errorMessage?: string;
  sentAt?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly sendGridApiKey: string;
  private readonly smsApiKey: string;
  private readonly smsApiUrl: string;
  private readonly sendGridApiUrl = 'https://api.sendgrid.com/v3/mail/send';
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly kakaoTalkApiUrl: string;
  private readonly kakaoTalkAccessToken: string;
  private readonly kakaoTalkDefaultTemplateCode: string;
  private readonly mockEmailMode: boolean;
  private readonly mockSmsMode: boolean;
  private readonly mockKakaoTalkMode: boolean;
  private readonly maxRetryCount: number;
  private readonly notifications = new Map<
    string,
    NotificationStatusView & { payload: NotificationPayload }
  >();
  private notificationSequence = 0;

  constructor(private readonly configService: ConfigService) {
    this.sendGridApiKey =
      this.configService.get<string>('SENDGRID_API_KEY') || '';
    this.smsApiKey = this.configService.get<string>('SMS_API_KEY') || '';
    this.smsApiUrl = this.configService.get<string>('SMS_API_URL') || '';
    this.fromEmail =
      this.configService.get<string>('FROM_EMAIL') ||
      'noreply@orderfriends.com';
    this.fromName =
      this.configService.get<string>('FROM_NAME') || 'OrderFriends';
    this.kakaoTalkApiUrl =
      this.configService.get<string>('KAKAO_TALK_API_URL') || '';
    this.kakaoTalkAccessToken =
      this.configService.get<string>('KAKAO_TALK_ACCESS_TOKEN') || '';
    this.kakaoTalkDefaultTemplateCode =
      this.configService.get<string>('KAKAO_TALK_DEFAULT_TEMPLATE_CODE') || '';
    this.maxRetryCount = Number(
      this.configService.get<string>('NOTIFICATION_MAX_RETRY') ?? 2,
    );

    const sendGridLiveMode =
      this.configService.get<string>('SENDGRID_LIVE_MODE') === 'true';
    const smsLiveMode =
      this.configService.get<string>('SMS_LIVE_MODE') === 'true';

    this.mockEmailMode = !this.sendGridApiKey || !sendGridLiveMode;
    this.mockSmsMode = !this.smsApiKey || !this.smsApiUrl || !smsLiveMode;
    this.mockKakaoTalkMode =
      !this.kakaoTalkApiUrl || !this.kakaoTalkAccessToken;

    if (this.mockEmailMode) {
      this.logger.warn(
        'Email notification running in mock mode (set SENDGRID_API_KEY + SENDGRID_LIVE_MODE=true for live mode)',
      );
    }

    if (this.mockSmsMode) {
      this.logger.warn(
        'SMS notification running in mock mode (set SMS_API_KEY + SMS_API_URL + SMS_LIVE_MODE=true for live mode)',
      );
    }

    if (this.mockKakaoTalkMode) {
      this.logger.warn(
        'KakaoTalk API not fully configured - KakaoTalk notifications in mock mode',
      );
    }

    if (!this.mockEmailMode && !this.mockSmsMode && !this.mockKakaoTalkMode) {
      this.logger.log('Notification service initialized with external APIs');
    }
  }

  /**
   * ========================================
   * EMAIL NOTIFICATIONS
   * ========================================
   */

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(
    orderId: string,
    orderData: OrderConfirmationEmailData,
    recipientEmail: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending order confirmation email for order: ${orderId}`);

    const template = this.getOrderConfirmationEmailTemplate(orderData);

    return this.sendEmail(
      recipientEmail,
      template.subject,
      template.html,
      template.text,
    );
  }

  /**
   * Send order status update email
   */
  async sendOrderStatusUpdate(
    orderId: string,
    orderData: OrderStatusUpdateEmailData,
    recipientEmail: string,
  ): Promise<NotificationResult> {
    this.logger.log(
      `Sending order status update email for order: ${orderId} (${orderData.oldStatus} -> ${orderData.newStatus})`,
    );

    const template = this.getOrderStatusUpdateEmailTemplate(orderData);

    return this.sendEmail(
      recipientEmail,
      template.subject,
      template.html,
      template.text,
    );
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(
    orderId: string,
    paymentData: PaymentConfirmationEmailData,
    recipientEmail: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending payment confirmation email for order: ${orderId}`);

    const template = this.getPaymentConfirmationEmailTemplate(paymentData);

    return this.sendEmail(
      recipientEmail,
      template.subject,
      template.html,
      template.text,
    );
  }

  /**
   * Send refund confirmation email
   */
  async sendRefundConfirmation(
    orderId: string,
    refundData: RefundConfirmationEmailData,
    recipientEmail: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending refund confirmation email for order: ${orderId}`);

    const template = this.getRefundConfirmationEmailTemplate(refundData);

    return this.sendEmail(
      recipientEmail,
      template.subject,
      template.html,
      template.text,
    );
  }

  /**
   * Send low stock alert email
   */
  async sendLowStockAlert(
    productId: string,
    branchId: string,
    stockData: LowStockAlertEmailData,
    recipientEmail: string,
  ): Promise<NotificationResult> {
    this.logger.log(
      `Sending low stock alert for product: ${productId} at branch: ${branchId}`,
    );

    const template = this.getLowStockAlertEmailTemplate(stockData);

    return this.sendEmail(
      recipientEmail,
      template.subject,
      template.html,
      template.text,
    );
  }

  /**
   * ========================================
   * SMS NOTIFICATIONS
   * ========================================
   */

  /**
   * Send order confirmation SMS
   */
  async sendOrderConfirmationSMS(
    orderId: string,
    smsData: OrderConfirmationSMSData,
    phone: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending order confirmation SMS for order: ${orderId}`);

    const message = this.getOrderConfirmationSMSTemplate(smsData);

    return this.sendSMS(phone, message);
  }

  /**
   * Send order ready SMS
   */
  async sendOrderReadySMS(
    orderId: string,
    smsData: OrderReadySMSData,
    phone: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending order ready SMS for order: ${orderId}`);

    const message = this.getOrderReadySMSTemplate(smsData);

    return this.sendSMS(phone, message);
  }

  /**
   * Send delivery complete SMS
   */
  async sendDeliveryCompleteSMS(
    orderId: string,
    smsData: DeliveryCompleteSMSData,
    phone: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending delivery complete SMS for order: ${orderId}`);

    const message = this.getDeliveryCompleteSMSTemplate(smsData);

    return this.sendSMS(phone, message);
  }

  /**
   * ========================================
   * KAKAO TALK NOTIFICATIONS
   * ========================================
   */

  /**
   * Send a KakaoTalk message
   */
  async sendKakaoTalk(
    phone: string,
    message: string,
    templateCode?: string,
  ): Promise<NotificationResult> {
    this.logger.log(`Sending KakaoTalk message to ${phone}`);

    return this.sendKakaoTalkMessage(phone, message, templateCode);
  }

  /**
   * ========================================
   * INTERNAL EMAIL SENDER
   * ========================================
   */

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<NotificationResult> {
    const payload: EmailPayload = {
      kind: 'EMAIL',
      subject,
      html,
      text,
    };

    return this.sendWithRetry(NotificationType.EMAIL, to, payload, () =>
      this.deliverEmail(to, payload),
    );
  }

  /**
   * ========================================
   * INTERNAL SMS SENDER
   * ========================================
   */

  private async sendSMS(
    to: string,
    message: string,
  ): Promise<NotificationResult> {
    const payload: SmsPayload = {
      kind: 'SMS',
      message,
    };

    return this.sendWithRetry(NotificationType.SMS, to, payload, () =>
      this.deliverSms(to, payload),
    );
  }

  /**
   * ========================================
   * INTERNAL KAKAO TALK SENDER
   * ========================================
   */

  private async sendKakaoTalkMessage(
    to: string,
    message: string,
    templateCode?: string,
  ): Promise<NotificationResult> {
    const payload: KakaoPayload = {
      kind: 'KAKAO_TALK',
      message,
      templateCode,
    };

    return this.sendWithRetry(NotificationType.KAKAO_TALK, to, payload, () =>
      this.deliverKakaoTalk(to, payload),
    );
  }

  private parseKakaoTalkResponseBody(
    body: string,
  ): Record<string, unknown> | null {
    if (!body) {
      return null;
    }

    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  private buildNotificationId(): string {
    this.notificationSequence += 1;
    return `ntf_${Date.now()}_${this.notificationSequence}`;
  }

  private async deliverEmail(to: string, payload: EmailPayload): Promise<void> {
    if (this.mockEmailMode) {
      this.logger.log('[MOCK EMAIL] ================================');
      this.logger.log(`To: ${to}`);
      this.logger.log(`From: ${this.fromName} <${this.fromEmail}>`);
      this.logger.log(`Subject: ${payload.subject}`);
      this.logger.log(`Text: ${payload.text || 'N/A'}`);
      this.logger.log('HTML:');
      this.logger.log(payload.html);
      this.logger.log('==============================================');
      return;
    }

    const response = await fetch(this.sendGridApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: this.fromEmail, name: this.fromName },
        subject: payload.subject,
        content: [
          { type: 'text/plain', value: payload.text || '' },
          { type: 'text/html', value: payload.html },
        ],
      }),
    });

    if (response.ok) {
      return;
    }

    const body = await response.text();
    throw new Error(
      `SendGrid API error: ${response.status} ${body || 'no response body'}`,
    );
  }

  private async deliverSms(to: string, payload: SmsPayload): Promise<void> {
    if (this.mockSmsMode) {
      this.logger.log('[MOCK SMS] ===================================');
      this.logger.log(`To: ${to}`);
      this.logger.log(`Message: ${payload.message}`);
      this.logger.log('==============================================');
      return;
    }

    const response = await fetch(this.smsApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.smsApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        message: payload.message,
      }),
    });

    if (response.ok) {
      return;
    }

    const body = await response.text();
    throw new Error(
      `SMS API error: ${response.status} ${body || 'no response body'}`,
    );
  }

  private async deliverKakaoTalk(
    to: string,
    payload: KakaoPayload,
  ): Promise<void> {
    if (this.mockKakaoTalkMode) {
      this.logger.log('[MOCK KAKAO TALK] ==========================');
      this.logger.log(`To: ${to}`);
      this.logger.log(
        `Template: ${payload.templateCode || this.kakaoTalkDefaultTemplateCode || 'default'}`,
      );
      this.logger.log(`Message: ${payload.message}`);
      this.logger.log('=============================================');
      return;
    }

    const response = await fetch(this.kakaoTalkApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.kakaoTalkAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: to,
        message: payload.message,
        templateCode:
          payload.templateCode ||
          this.kakaoTalkDefaultTemplateCode ||
          undefined,
      }),
    });

    const responseText = await response.text();
    const responseBody = this.parseKakaoTalkResponseBody(responseText);

    if (!response.ok) {
      const details = responseBody
        ? JSON.stringify(responseBody)
        : responseText || 'no response body';
      throw new Error(`KakaoTalk API error: ${response.status} ${details}`);
    }
  }

  private async sendWithRetry(
    type: NotificationType,
    recipient: string,
    payload: NotificationPayload,
    sender: () => Promise<void>,
    notificationId?: string,
  ): Promise<NotificationResult> {
    const id = notificationId || this.buildNotificationId();
    const current = this.notifications.get(id);

    const statusEntry: NotificationStatusView & {
      payload: NotificationPayload;
    } = current ?? {
      id,
      type,
      status: NotificationStatus.PENDING,
      recipient,
      retryCount: 0,
      payload,
    };

    this.notifications.set(id, statusEntry);

    let lastErrorMessage: string | undefined;
    for (let attempt = 0; attempt <= this.maxRetryCount; attempt += 1) {
      try {
        await sender();

        const sentAt = new Date().toISOString();
        statusEntry.status = NotificationStatus.SENT;
        statusEntry.retryCount = attempt;
        statusEntry.errorMessage = undefined;
        statusEntry.sentAt = sentAt;
        this.notifications.set(id, statusEntry);

        return {
          success: true,
          type,
          recipient,
          retryCount: attempt,
          sentAt,
        };
      } catch (error) {
        lastErrorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to send ${type} to ${recipient} (attempt ${attempt + 1}/${this.maxRetryCount + 1}): ${lastErrorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    statusEntry.status = NotificationStatus.FAILED;
    statusEntry.retryCount = this.maxRetryCount;
    statusEntry.errorMessage = lastErrorMessage || 'unknown error';
    statusEntry.sentAt = undefined;
    this.notifications.set(id, statusEntry);

    return {
      success: false,
      type,
      recipient,
      retryCount: this.maxRetryCount,
      errorMessage: statusEntry.errorMessage,
    };
  }

  /**
   * ========================================
   * EMAIL TEMPLATE FUNCTIONS
   * ========================================
   */

  private getOrderConfirmationEmailTemplate(
    data: OrderConfirmationEmailData,
  ): EmailTemplate {
    const subject = `Order Confirmation - ${data.orderNo}`;

    const itemsHtml = data.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${item.name}${item.option ? ` (${item.option})` : ''}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
            ${item.qty}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
            ${item.unitPrice.toLocaleString()}원
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
            ${(item.qty * item.unitPrice).toLocaleString()}원
          </td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
              Order Confirmed
            </h1>

            <p>Hello ${data.customerName},</p>
            <p>Your order has been confirmed.</p>

            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>Order No:</strong> ${data.orderNo}</p>
              <p style="margin: 5px 0;"><strong>Ordered At:</strong> ${new Date(data.orderedAt).toLocaleString('ko-KR')}</p>
            </div>

            <h2 style="color: #333; margin-top: 30px;">Items</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Unit</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 5px;">Subtotal:</td>
                  <td style="padding: 5px; text-align: right;">${data.subtotal.toLocaleString()}원</td>
                </tr>
                <tr>
                  <td style="padding: 5px;">Shipping:</td>
                  <td style="padding: 5px; text-align: right;">${data.shippingFee.toLocaleString()}원</td>
                </tr>
                ${
                  data.discount > 0
                    ? `
                <tr>
                  <td style="padding: 5px;">Discount:</td>
                  <td style="padding: 5px; text-align: right; color: #f44336;">-${data.discount.toLocaleString()}원</td>
                </tr>
                `
                    : ''
                }
                <tr style="border-top: 2px solid #ddd; font-weight: bold; font-size: 1.1em;">
                  <td style="padding: 10px 5px;">Total:</td>
                  <td style="padding: 10px 5px; text-align: right; color: #4CAF50;">${data.total.toLocaleString()}원</td>
                </tr>
              </table>
            </div>

            ${
              data.deliveryAddress
                ? `
            <h2 style="color: #333; margin-top: 30px;">Delivery</h2>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>Address:</strong> ${data.deliveryAddress}</p>
              ${data.deliveryMemo ? `<p style="margin: 5px 0;"><strong>Note:</strong> ${data.deliveryMemo}</p>` : ''}
            </div>
            `
                : ''
            }
          </div>
        </body>
      </html>
    `;

    const text = `
Order confirmed.

Hello ${data.customerName},

Order No: ${data.orderNo}
Ordered At: ${new Date(data.orderedAt).toLocaleString('ko-KR')}
Total: ${data.total.toLocaleString()}원
    `;

    return { subject, html, text };
  }

  private getOrderStatusUpdateEmailTemplate(
    data: OrderStatusUpdateEmailData,
  ): EmailTemplate {
    const subject = `Order Status Update - ${data.orderNo}`;

    const statusMessages: Record<string, string> = {
      PENDING: 'Pending',
      CONFIRMED: 'Confirmed',
      PREPARING: 'Preparing',
      READY: 'Ready',
      SHIPPING: 'Shipping',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
      REFUNDED: 'Refunded',
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order Status Update</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2196F3; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">
              Order Status Updated
            </h1>

            <p>Hello ${data.customerName},</p>

            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>Order No:</strong> ${data.orderNo}</p>
              <p style="margin: 5px 0;"><strong>Updated At:</strong> ${new Date(data.updatedAt).toLocaleString('ko-KR')}</p>
            </div>

            <div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #2196F3;">
              <p style="margin: 0; font-size: 1.1em;">
                <strong>Status:</strong> ${statusMessages[data.newStatus] || data.newStatus}
              </p>
              ${data.statusMessage ? `<p style="margin: 10px 0 0 0; color: #666;">${data.statusMessage}</p>` : ''}
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Order status updated.

Hello ${data.customerName},

Order No: ${data.orderNo}
Status: ${statusMessages[data.newStatus] || data.newStatus}
${data.statusMessage ? `Message: ${data.statusMessage}` : ''}

Updated At: ${new Date(data.updatedAt).toLocaleString('ko-KR')}
    `;

    return { subject, html, text };
  }

  private getPaymentConfirmationEmailTemplate(
    data: PaymentConfirmationEmailData,
  ): EmailTemplate {
    const subject = `Payment Confirmation - ${data.orderNo}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
              Payment Completed
            </h1>

            <p>Hello ${data.customerName},</p>
            <p>Your payment has been completed successfully.</p>

            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>Order No:</strong> ${data.orderNo}</p>
              <p style="margin: 5px 0;"><strong>Paid At:</strong> ${new Date(data.paidAt).toLocaleString('ko-KR')}</p>
              ${data.transactionId ? `<p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${data.transactionId}</p>` : ''}
            </div>

            <div style="background-color: #e8f5e9; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 5px;"><strong>Payment Method:</strong></td>
                  <td style="padding: 5px; text-align: right;">${data.paymentMethod}</td>
                </tr>
                <tr style="border-top: 2px solid #4CAF50;">
                  <td style="padding: 10px 5px; font-size: 1.2em;"><strong>Amount:</strong></td>
                  <td style="padding: 10px 5px; text-align: right; font-size: 1.2em; color: #4CAF50;">
                    <strong>${data.amount.toLocaleString()}원</strong>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Payment completed.

Hello ${data.customerName},

Order No: ${data.orderNo}
Payment Method: ${data.paymentMethod}
Amount: ${data.amount.toLocaleString()}원
Paid At: ${new Date(data.paidAt).toLocaleString('ko-KR')}
${data.transactionId ? `Transaction ID: ${data.transactionId}` : ''}
    `;

    return { subject, html, text };
  }

  private getRefundConfirmationEmailTemplate(
    data: RefundConfirmationEmailData,
  ): EmailTemplate {
    const subject = `Refund Confirmation - ${data.orderNo}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Refund Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #FF9800; border-bottom: 2px solid #FF9800; padding-bottom: 10px;">
              Refund Completed
            </h1>

            <p>Hello ${data.customerName},</p>
            <p>Your refund has been processed.</p>

            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>Order No:</strong> ${data.orderNo}</p>
              <p style="margin: 5px 0;"><strong>Refunded At:</strong> ${new Date(data.refundedAt).toLocaleString('ko-KR')}</p>
              ${data.transactionId ? `<p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${data.transactionId}</p>` : ''}
              ${data.refundReason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${data.refundReason}</p>` : ''}
            </div>

            <div style="background-color: #fff3e0; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; font-size: 1.2em;">
                <strong>Refund Amount:</strong>
                <span style="color: #FF9800; font-size: 1.2em;">${data.refundAmount.toLocaleString()}원</span>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Refund completed.

Hello ${data.customerName},

Order No: ${data.orderNo}
Refund Amount: ${data.refundAmount.toLocaleString()}원
Refunded At: ${new Date(data.refundedAt).toLocaleString('ko-KR')}
${data.refundReason ? `Reason: ${data.refundReason}` : ''}
    `;

    return { subject, html, text };
  }

  private getLowStockAlertEmailTemplate(
    data: LowStockAlertEmailData,
  ): EmailTemplate {
    const subject = `Low Stock Alert - ${data.productName}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Low Stock Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f44336; border-bottom: 2px solid #f44336; padding-bottom: 10px;">
              Low Stock Alert
            </h1>

            <p>The following item is below the minimum stock level.</p>

            <div style="background-color: #ffebee; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #f44336;">
              <p style="margin: 5px 0;"><strong>Product:</strong> ${data.productName}</p>
              ${data.productSku ? `<p style="margin: 5px 0;"><strong>SKU:</strong> ${data.productSku}</p>` : ''}
              <p style="margin: 5px 0;"><strong>Branch:</strong> ${data.branchName}</p>
              <p style="margin: 5px 0;"><strong>Current Stock:</strong> <span style="color: #f44336; font-size: 1.2em; font-weight: bold;">${data.currentStock}</span></p>
              <p style="margin: 5px 0;"><strong>Minimum Stock:</strong> ${data.minimumStock}</p>
              <p style="margin: 5px 0;"><strong>Alerted At:</strong> ${new Date(data.alertedAt).toLocaleString('ko-KR')}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Low Stock Alert

Product: ${data.productName}
${data.productSku ? `SKU: ${data.productSku}` : ''}
Branch: ${data.branchName}
Current Stock: ${data.currentStock}
Minimum Stock: ${data.minimumStock}
Alerted At: ${new Date(data.alertedAt).toLocaleString('ko-KR')}
    `;

    return { subject, html, text };
  }

  /**
   * ========================================
   * SMS TEMPLATE FUNCTIONS
   * ========================================
   */

  private getOrderConfirmationSMSTemplate(
    data: OrderConfirmationSMSData,
  ): string {
    return `[OrderFriends] ${data.customerName}, your order is confirmed. Order No: ${data.orderNo}, Amount: ${data.total.toLocaleString()}원`;
  }

  private getOrderReadySMSTemplate(data: OrderReadySMSData): string {
    const contactInfo = data.branchPhone
      ? ` (Contact: ${data.branchPhone})`
      : '';
    return `[OrderFriends] Order ${data.orderNo} is ready at ${data.branchName}.${contactInfo}`;
  }

  private getDeliveryCompleteSMSTemplate(
    data: DeliveryCompleteSMSData,
  ): string {
    return `[OrderFriends] Order ${data.orderNo} has been delivered. Thank you.`;
  }

  /**
   * ========================================
   * UTILITY METHODS
   * ========================================
   */

  /**
   * Retry failed notification
   */
  async retryNotification(notificationId: string): Promise<NotificationResult> {
    const statusEntry = this.notifications.get(notificationId);
    if (!statusEntry) {
      return {
        success: false,
        type: NotificationType.EMAIL,
        recipient: 'unknown',
        errorMessage: 'Notification not found',
      };
    }

    switch (statusEntry.payload.kind) {
      case 'EMAIL': {
        const payload: EmailPayload = statusEntry.payload;
        return this.sendWithRetry(
          NotificationType.EMAIL,
          statusEntry.recipient,
          payload,
          () => this.deliverEmail(statusEntry.recipient, payload),
          notificationId,
        );
      }
      case 'SMS': {
        const payload: SmsPayload = statusEntry.payload;
        return this.sendWithRetry(
          NotificationType.SMS,
          statusEntry.recipient,
          payload,
          () => this.deliverSms(statusEntry.recipient, payload),
          notificationId,
        );
      }
      case 'KAKAO_TALK': {
        const payload: KakaoPayload = statusEntry.payload;
        return this.sendWithRetry(
          NotificationType.KAKAO_TALK,
          statusEntry.recipient,
          payload,
          () => this.deliverKakaoTalk(statusEntry.recipient, payload),
          notificationId,
        );
      }
      default:
        return {
          success: false,
          type: statusEntry.type,
          recipient: statusEntry.recipient,
          errorMessage: 'Unsupported notification type',
        };
    }
  }

  /**
   * Get notification status
   */
  getNotificationStatus(
    notificationId: string,
  ): Promise<NotificationStatusView | null> {
    const statusEntry = this.notifications.get(notificationId);
    if (!statusEntry) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      id: statusEntry.id,
      type: statusEntry.type,
      status: statusEntry.status,
      recipient: statusEntry.recipient,
      retryCount: statusEntry.retryCount,
      errorMessage: statusEntry.errorMessage,
      sentAt: statusEntry.sentAt,
    });
  }
}
