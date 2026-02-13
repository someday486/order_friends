import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationType,
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

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly sendGridApiKey: string;
  private readonly smsApiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly kakaoTalkApiUrl: string;
  private readonly kakaoTalkAccessToken: string;
  private readonly kakaoTalkDefaultTemplateCode: string;
  private readonly mockMode: boolean;
  private readonly mockKakaoTalkMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.sendGridApiKey =
      this.configService.get<string>('SENDGRID_API_KEY') || '';
    this.smsApiKey = this.configService.get<string>('SMS_API_KEY') || '';
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

    // Mock mode if no API keys configured
    this.mockMode = !this.sendGridApiKey || !this.smsApiKey;
    this.mockKakaoTalkMode =
      this.mockMode || !this.kakaoTalkApiUrl || !this.kakaoTalkAccessToken;

    if (this.mockMode) {
      this.logger.warn(
        'Notification service running in MOCK MODE - API keys not configured',
      );
    } else if (this.mockKakaoTalkMode) {
      this.logger.warn(
        'KakaoTalk API not fully configured - KakaoTalk notifications in mock mode',
      );
    } else {
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
      `Sending order status update email for order: ${orderId} (${orderData.oldStatus} ??${orderData.newStatus})`,
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

  private sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: false,
      type: NotificationType.EMAIL,
      recipient: to,
      retryCount: 0,
    };

    try {
      if (this.mockMode) {
        // Mock mode - just log the email
        this.logger.log('[MOCK EMAIL] ================================');
        this.logger.log(`To: ${to}`);
        this.logger.log(`From: ${this.fromName} <${this.fromEmail}>`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log(`Text: ${text || 'N/A'}`);
        this.logger.log('HTML:');
        this.logger.log(html);
        this.logger.log('==============================================');

        result.success = true;
        result.sentAt = new Date().toISOString();
      } else {
        // TODO: Integrate with SendGrid API
        // const sgMail = require('@sendgrid/mail');
        // sgMail.setApiKey(this.sendGridApiKey);
        //
        // const msg = {
        //   to,
        //   from: { email: this.fromEmail, name: this.fromName },
        //   subject,
        //   text: text || '',
        //   html,
        // };
        //
        // await sgMail.send(msg);

        this.logger.warn(
          'SendGrid integration not implemented yet - using mock mode',
        );
        result.success = true;
        result.sentAt = new Date().toISOString();
      }
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error.message}`,
        error.stack,
      );
      result.success = false;
      result.errorMessage = error.message;

      // TODO: Implement retry logic
      // TODO: Add to notification queue for later retry
    }

    return Promise.resolve(result);
  }

  /**
   * ========================================
   * INTERNAL SMS SENDER
   * ========================================
   */

  private sendSMS(to: string, message: string): Promise<NotificationResult> {
    const result: NotificationResult = {
      success: false,
      type: NotificationType.SMS,
      recipient: to,
      retryCount: 0,
    };

    try {
      if (this.mockMode) {
        // Mock mode - just log the SMS
        this.logger.log('[MOCK SMS] ===================================');
        this.logger.log(`To: ${to}`);
        this.logger.log(`Message: ${message}`);
        this.logger.log('==============================================');

        result.success = true;
        result.sentAt = new Date().toISOString();
      } else {
        // TODO: Integrate with SMS API (Twilio, AWS SNS, etc.)
        // Example with Twilio:
        // const client = require('twilio')(accountSid, authToken);
        //
        // await client.messages.create({
        //   body: message,
        //   from: '+1234567890',
        //   to,
        // });

        this.logger.warn(
          'SMS API integration not implemented yet - using mock mode',
        );
        result.success = true;
        result.sentAt = new Date().toISOString();
      }
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${to}: ${error.message}`,
        error.stack,
      );
      result.success = false;
      result.errorMessage = error.message;

      // TODO: Implement retry logic
      // TODO: Add to notification queue for later retry
    }

    return Promise.resolve(result);
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
    const result: NotificationResult = {
      success: false,
      type: NotificationType.KAKAO_TALK,
      recipient: to,
      retryCount: 0,
    };

    try {
      if (this.mockKakaoTalkMode) {
        // Mock mode - just log the KakaoTalk payload
        this.logger.log('[MOCK KAKAO TALK] ==========================');
        this.logger.log(`To: ${to}`);
        this.logger.log(
          `Template: ${templateCode || this.kakaoTalkDefaultTemplateCode || 'default'}`,
        );
        this.logger.log(`Message: ${message}`);
        this.logger.log('=============================================');

        result.success = true;
        result.sentAt = new Date().toISOString();
        return result;
      }

      const response = await fetch(this.kakaoTalkApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.kakaoTalkAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: to,
          message,
          templateCode:
            templateCode || this.kakaoTalkDefaultTemplateCode || undefined,
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

      result.success = true;
      result.sentAt = new Date().toISOString();
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send KakaoTalk to ${to}: ${error.message}`,
        error.stack,
      );
      result.success = false;
      result.errorMessage = error.message;
      return result;
    }
  }

  private parseKakaoTalkResponseBody(body: string): any {
    if (!body) {
      return null;
    }

    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
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
   * TODO: Implement with queue system
   */
  retryNotification(notificationId: string): Promise<NotificationResult> {
    this.logger.warn(
      `Retry notification not implemented yet: ${notificationId}`,
    );
    return Promise.resolve({
      success: false,
      type: NotificationType.EMAIL,
      recipient: 'unknown',
      errorMessage: 'Retry not implemented',
    });
  }

  /**
   * Get notification status
   * TODO: Implement with database
   */
  getNotificationStatus(notificationId: string): Promise<unknown> {
    this.logger.warn(
      `Get notification status not implemented yet: ${notificationId}`,
    );
    return Promise.resolve(null);
  }
}
