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
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY') || '';
    this.smsApiKey = this.configService.get<string>('SMS_API_KEY') || '';
    this.fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@orderfriends.com';
    this.fromName = this.configService.get<string>('FROM_NAME') || 'OrderFriends';

    // Mock mode if no API keys configured
    this.mockMode = !this.sendGridApiKey || !this.smsApiKey;

    if (this.mockMode) {
      this.logger.warn('🔔 Notification service running in MOCK MODE - API keys not configured');
    } else {
      this.logger.log('✅ Notification service initialized with external APIs');
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
    this.logger.log(`Sending order status update email for order: ${orderId} (${orderData.oldStatus} → ${orderData.newStatus})`);

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
    this.logger.log(`Sending low stock alert for product: ${productId} at branch: ${branchId}`);

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
   * INTERNAL EMAIL SENDER
   * ========================================
   */

  private async sendEmail(
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
        this.logger.log('📧 [MOCK EMAIL] ================================');
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

        this.logger.warn('SendGrid integration not implemented yet - using mock mode');
        result.success = true;
        result.sentAt = new Date().toISOString();
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`, error.stack);
      result.success = false;
      result.errorMessage = error.message;

      // TODO: Implement retry logic
      // TODO: Add to notification queue for later retry
    }

    return result;
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
    const result: NotificationResult = {
      success: false,
      type: NotificationType.SMS,
      recipient: to,
      retryCount: 0,
    };

    try {
      if (this.mockMode) {
        // Mock mode - just log the SMS
        this.logger.log('📱 [MOCK SMS] ===================================');
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

        this.logger.warn('SMS API integration not implemented yet - using mock mode');
        result.success = true;
        result.sentAt = new Date().toISOString();
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`, error.stack);
      result.success = false;
      result.errorMessage = error.message;

      // TODO: Implement retry logic
      // TODO: Add to notification queue for later retry
    }

    return result;
  }

  /**
   * ========================================
   * EMAIL TEMPLATE FUNCTIONS
   * ========================================
   */

  private getOrderConfirmationEmailTemplate(
    data: OrderConfirmationEmailData,
  ): EmailTemplate {
    const subject = `주문 확인 - 주문번호 ${data.orderNo}`;

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
          <title>주문 확인</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
              주문이 완료되었습니다
            </h1>

            <p>안녕하세요, ${data.customerName}님!</p>
            <p>주문이 성공적으로 완료되었습니다.</p>

            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>주문번호:</strong> ${data.orderNo}</p>
              <p style="margin: 5px 0;"><strong>주문일시:</strong> ${new Date(data.orderedAt).toLocaleString('ko-KR')}</p>
            </div>

            <h2 style="color: #333; margin-top: 30px;">주문 상품</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">상품명</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">수량</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">단가</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">합계</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="margin-top: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 5px;">상품 금액:</td>
                  <td style="padding: 5px; text-align: right;">${data.subtotal.toLocaleString()}원</td>
                </tr>
                <tr>
                  <td style="padding: 5px;">배송비:</td>
                  <td style="padding: 5px; text-align: right;">${data.shippingFee.toLocaleString()}원</td>
                </tr>
                ${
                  data.discount > 0
                    ? `
                <tr>
                  <td style="padding: 5px;">할인:</td>
                  <td style="padding: 5px; text-align: right; color: #f44336;">-${data.discount.toLocaleString()}원</td>
                </tr>
                `
                    : ''
                }
                <tr style="border-top: 2px solid #ddd; font-weight: bold; font-size: 1.1em;">
                  <td style="padding: 10px 5px;">총 결제금액:</td>
                  <td style="padding: 10px 5px; text-align: right; color: #4CAF50;">${data.total.toLocaleString()}원</td>
                </tr>
              </table>
            </div>

            ${
              data.deliveryAddress
                ? `
            <h2 style="color: #333; margin-top: 30px;">배송 정보</h2>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>배송지:</strong> ${data.deliveryAddress}</p>
              ${data.deliveryMemo ? `<p style="margin: 5px 0;"><strong>배송 메모:</strong> ${data.deliveryMemo}</p>` : ''}
            </div>
            `
                : ''
            }

            <p style="margin-top: 30px; color: #666;">
              주문 내역은 주문 내역 페이지에서 확인하실 수 있습니다.
            </p>

            <p style="margin-top: 20px; color: #999; font-size: 0.9em;">
              문의사항이 있으시면 고객센터로 연락 주세요.<br>
              감사합니다.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
주문이 완료되었습니다

안녕하세요, ${data.customerName}님!

주문번호: ${data.orderNo}
주문일시: ${new Date(data.orderedAt).toLocaleString('ko-KR')}

총 결제금액: ${data.total.toLocaleString()}원

주문해 주셔서 감사합니다.
    `;

    return { subject, html, text };
  }

  private getOrderStatusUpdateEmailTemplate(
    data: OrderStatusUpdateEmailData,
  ): EmailTemplate {
    const subject = `주문 상태 변경 - 주문번호 ${data.orderNo}`;

    const statusMessages: Record<string, string> = {
      PENDING: '주문 접수 대기 중',
      CONFIRMED: '주문이 확인되었습니다',
      PREPARING: '상품을 준비 중입니다',
      READY: '상품이 준비되었습니다',
      SHIPPING: '배송 중입니다',
      DELIVERED: '배송이 완료되었습니다',
      CANCELLED: '주문이 취소되었습니다',
      REFUNDED: '환불이 완료되었습니다',
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>주문 상태 변경</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2196F3; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">
              주문 상태가 변경되었습니다
            </h1>

            <p>안녕하세요, ${data.customerName}님!</p>

            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>주문번호:</strong> ${data.orderNo}</p>
              <p style="margin: 5px 0;"><strong>변경일시:</strong> ${new Date(data.updatedAt).toLocaleString('ko-KR')}</p>
            </div>

            <div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #2196F3;">
              <p style="margin: 0; font-size: 1.1em;">
                <strong>현재 상태:</strong> ${statusMessages[data.newStatus] || data.newStatus}
              </p>
              ${data.statusMessage ? `<p style="margin: 10px 0 0 0; color: #666;">${data.statusMessage}</p>` : ''}
            </div>

            <p style="margin-top: 20px; color: #666;">
              주문 상세 내역은 주문 내역 페이지에서 확인하실 수 있습니다.
            </p>

            <p style="margin-top: 20px; color: #999; font-size: 0.9em;">
              문의사항이 있으시면 고객센터로 연락 주세요.<br>
              감사합니다.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
주문 상태가 변경되었습니다

안녕하세요, ${data.customerName}님!

주문번호: ${data.orderNo}
현재 상태: ${statusMessages[data.newStatus] || data.newStatus}
${data.statusMessage ? `메시지: ${data.statusMessage}` : ''}

변경일시: ${new Date(data.updatedAt).toLocaleString('ko-KR')}
    `;

    return { subject, html, text };
  }

  private getPaymentConfirmationEmailTemplate(
    data: PaymentConfirmationEmailData,
  ): EmailTemplate {
    const subject = `결제 완료 - 주문번호 ${data.orderNo}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>결제 완료</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
              결제가 완료되었습니다
            </h1>

            <p>안녕하세요, ${data.customerName}님!</p>
            <p>결제가 성공적으로 완료되었습니다.</p>

            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>주문번호:</strong> ${data.orderNo}</p>
              <p style="margin: 5px 0;"><strong>결제일시:</strong> ${new Date(data.paidAt).toLocaleString('ko-KR')}</p>
              ${data.transactionId ? `<p style="margin: 5px 0;"><strong>거래번호:</strong> ${data.transactionId}</p>` : ''}
            </div>

            <div style="background-color: #e8f5e9; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 5px;"><strong>결제수단:</strong></td>
                  <td style="padding: 5px; text-align: right;">${data.paymentMethod}</td>
                </tr>
                <tr style="border-top: 2px solid #4CAF50;">
                  <td style="padding: 10px 5px; font-size: 1.2em;"><strong>결제금액:</strong></td>
                  <td style="padding: 10px 5px; text-align: right; font-size: 1.2em; color: #4CAF50;">
                    <strong>${data.amount.toLocaleString()}원</strong>
                  </td>
                </tr>
              </table>
            </div>

            <p style="margin-top: 20px; color: #666;">
              영수증은 주문 내역 페이지에서 확인하실 수 있습니다.
            </p>

            <p style="margin-top: 20px; color: #999; font-size: 0.9em;">
              문의사항이 있으시면 고객센터로 연락 주세요.<br>
              감사합니다.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
결제가 완료되었습니다

안녕하세요, ${data.customerName}님!

주문번호: ${data.orderNo}
결제수단: ${data.paymentMethod}
결제금액: ${data.amount.toLocaleString()}원
결제일시: ${new Date(data.paidAt).toLocaleString('ko-KR')}
${data.transactionId ? `거래번호: ${data.transactionId}` : ''}

결제해 주셔서 감사합니다.
    `;

    return { subject, html, text };
  }

  private getRefundConfirmationEmailTemplate(
    data: RefundConfirmationEmailData,
  ): EmailTemplate {
    const subject = `환불 완료 - 주문번호 ${data.orderNo}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>환불 완료</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #FF9800; border-bottom: 2px solid #FF9800; padding-bottom: 10px;">
              환불이 완료되었습니다
            </h1>

            <p>안녕하세요, ${data.customerName}님!</p>
            <p>환불 처리가 완료되었습니다.</p>

            <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>주문번호:</strong> ${data.orderNo}</p>
              <p style="margin: 5px 0;"><strong>환불일시:</strong> ${new Date(data.refundedAt).toLocaleString('ko-KR')}</p>
              ${data.transactionId ? `<p style="margin: 5px 0;"><strong>거래번호:</strong> ${data.transactionId}</p>` : ''}
              ${data.refundReason ? `<p style="margin: 5px 0;"><strong>환불사유:</strong> ${data.refundReason}</p>` : ''}
            </div>

            <div style="background-color: #fff3e0; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; font-size: 1.2em;">
                <strong>환불금액:</strong>
                <span style="color: #FF9800; font-size: 1.2em;">${data.refundAmount.toLocaleString()}원</span>
              </p>
            </div>

            <p style="margin-top: 20px; color: #666;">
              환불 금액은 결제하신 수단으로 영업일 기준 3-5일 이내에 입금될 예정입니다.
            </p>

            <p style="margin-top: 20px; color: #999; font-size: 0.9em;">
              문의사항이 있으시면 고객센터로 연락 주세요.<br>
              감사합니다.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
환불이 완료되었습니다

안녕하세요, ${data.customerName}님!

주문번호: ${data.orderNo}
환불금액: ${data.refundAmount.toLocaleString()}원
환불일시: ${new Date(data.refundedAt).toLocaleString('ko-KR')}
${data.refundReason ? `환불사유: ${data.refundReason}` : ''}

환불 금액은 결제하신 수단으로 영업일 기준 3-5일 이내에 입금될 예정입니다.
    `;

    return { subject, html, text };
  }

  private getLowStockAlertEmailTemplate(
    data: LowStockAlertEmailData,
  ): EmailTemplate {
    const subject = `⚠️ 재고 부족 알림 - ${data.productName}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>재고 부족 알림</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #f44336; border-bottom: 2px solid #f44336; padding-bottom: 10px;">
              ⚠️ 재고 부족 알림
            </h1>

            <p>다음 상품의 재고가 최소 수량 미만으로 떨어졌습니다.</p>

            <div style="background-color: #ffebee; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #f44336;">
              <p style="margin: 5px 0;"><strong>상품명:</strong> ${data.productName}</p>
              ${data.productSku ? `<p style="margin: 5px 0;"><strong>SKU:</strong> ${data.productSku}</p>` : ''}
              <p style="margin: 5px 0;"><strong>지점:</strong> ${data.branchName}</p>
              <p style="margin: 5px 0;"><strong>현재 재고:</strong> <span style="color: #f44336; font-size: 1.2em; font-weight: bold;">${data.currentStock}개</span></p>
              <p style="margin: 5px 0;"><strong>최소 재고:</strong> ${data.minimumStock}개</p>
              <p style="margin: 5px 0;"><strong>알림일시:</strong> ${new Date(data.alertedAt).toLocaleString('ko-KR')}</p>
            </div>

            <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
              <p style="margin: 0;"><strong>⚡ 조치가 필요합니다:</strong></p>
              <ul style="margin: 10px 0;">
                <li>재고를 확인하세요</li>
                <li>필요시 발주를 진행하세요</li>
                <li>상품 판매 여부를 검토하세요</li>
              </ul>
            </div>

            <p style="margin-top: 20px; color: #999; font-size: 0.9em;">
              이 알림은 자동으로 발송되었습니다.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
⚠️ 재고 부족 알림

상품명: ${data.productName}
${data.productSku ? `SKU: ${data.productSku}` : ''}
지점: ${data.branchName}
현재 재고: ${data.currentStock}개
최소 재고: ${data.minimumStock}개
알림일시: ${new Date(data.alertedAt).toLocaleString('ko-KR')}

조치가 필요합니다.
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
    return `[OrderFriends] ${data.customerName}님, 주문이 완료되었습니다. 주문번호: ${data.orderNo}, 금액: ${data.total.toLocaleString()}원`;
  }

  private getOrderReadySMSTemplate(data: OrderReadySMSData): string {
    const contactInfo = data.branchPhone
      ? ` (문의: ${data.branchPhone})`
      : '';
    return `[OrderFriends] 주문번호 ${data.orderNo}의 상품이 준비되었습니다. ${data.branchName}에서 수령 가능합니다${contactInfo}`;
  }

  private getDeliveryCompleteSMSTemplate(
    data: DeliveryCompleteSMSData,
  ): string {
    return `[OrderFriends] 주문번호 ${data.orderNo}의 배송이 완료되었습니다. 이용해 주셔서 감사합니다.`;
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
  async retryNotification(notificationId: string): Promise<NotificationResult> {
    this.logger.warn(`Retry notification not implemented yet: ${notificationId}`);
    return {
      success: false,
      type: NotificationType.EMAIL,
      recipient: 'unknown',
      errorMessage: 'Retry not implemented',
    };
  }

  /**
   * Get notification status
   * TODO: Implement with database
   */
  async getNotificationStatus(notificationId: string): Promise<any> {
    this.logger.warn(`Get notification status not implemented yet: ${notificationId}`);
    return null;
  }
}
