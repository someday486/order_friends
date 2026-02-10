"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const notification_dto_1 = require("./dto/notification.dto");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    configService;
    logger = new common_1.Logger(NotificationsService_1.name);
    sendGridApiKey;
    smsApiKey;
    fromEmail;
    fromName;
    mockMode;
    constructor(configService) {
        this.configService = configService;
        this.sendGridApiKey =
            this.configService.get('SENDGRID_API_KEY') || '';
        this.smsApiKey = this.configService.get('SMS_API_KEY') || '';
        this.fromEmail =
            this.configService.get('FROM_EMAIL') ||
                'noreply@orderfriends.com';
        this.fromName =
            this.configService.get('FROM_NAME') || 'OrderFriends';
        this.mockMode = !this.sendGridApiKey || !this.smsApiKey;
        if (this.mockMode) {
            this.logger.warn('Notification service running in MOCK MODE - API keys not configured');
        }
        else {
            this.logger.log('Notification service initialized with external APIs');
        }
    }
    async sendOrderConfirmation(orderId, orderData, recipientEmail) {
        this.logger.log(`Sending order confirmation email for order: ${orderId}`);
        const template = this.getOrderConfirmationEmailTemplate(orderData);
        return this.sendEmail(recipientEmail, template.subject, template.html, template.text);
    }
    async sendOrderStatusUpdate(orderId, orderData, recipientEmail) {
        this.logger.log(`Sending order status update email for order: ${orderId} (${orderData.oldStatus} ??${orderData.newStatus})`);
        const template = this.getOrderStatusUpdateEmailTemplate(orderData);
        return this.sendEmail(recipientEmail, template.subject, template.html, template.text);
    }
    async sendPaymentConfirmation(orderId, paymentData, recipientEmail) {
        this.logger.log(`Sending payment confirmation email for order: ${orderId}`);
        const template = this.getPaymentConfirmationEmailTemplate(paymentData);
        return this.sendEmail(recipientEmail, template.subject, template.html, template.text);
    }
    async sendRefundConfirmation(orderId, refundData, recipientEmail) {
        this.logger.log(`Sending refund confirmation email for order: ${orderId}`);
        const template = this.getRefundConfirmationEmailTemplate(refundData);
        return this.sendEmail(recipientEmail, template.subject, template.html, template.text);
    }
    async sendLowStockAlert(productId, branchId, stockData, recipientEmail) {
        this.logger.log(`Sending low stock alert for product: ${productId} at branch: ${branchId}`);
        const template = this.getLowStockAlertEmailTemplate(stockData);
        return this.sendEmail(recipientEmail, template.subject, template.html, template.text);
    }
    async sendOrderConfirmationSMS(orderId, smsData, phone) {
        this.logger.log(`Sending order confirmation SMS for order: ${orderId}`);
        const message = this.getOrderConfirmationSMSTemplate(smsData);
        return this.sendSMS(phone, message);
    }
    async sendOrderReadySMS(orderId, smsData, phone) {
        this.logger.log(`Sending order ready SMS for order: ${orderId}`);
        const message = this.getOrderReadySMSTemplate(smsData);
        return this.sendSMS(phone, message);
    }
    async sendDeliveryCompleteSMS(orderId, smsData, phone) {
        this.logger.log(`Sending delivery complete SMS for order: ${orderId}`);
        const message = this.getDeliveryCompleteSMSTemplate(smsData);
        return this.sendSMS(phone, message);
    }
    async sendEmail(to, subject, html, text) {
        const result = {
            success: false,
            type: notification_dto_1.NotificationType.EMAIL,
            recipient: to,
            retryCount: 0,
        };
        try {
            if (this.mockMode) {
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
            }
            else {
                this.logger.warn('SendGrid integration not implemented yet - using mock mode');
                result.success = true;
                result.sentAt = new Date().toISOString();
            }
        }
        catch (error) {
            this.logger.error(`Failed to send email to ${to}: ${error.message}`, error.stack);
            result.success = false;
            result.errorMessage = error.message;
        }
        return result;
    }
    async sendSMS(to, message) {
        const result = {
            success: false,
            type: notification_dto_1.NotificationType.SMS,
            recipient: to,
            retryCount: 0,
        };
        try {
            if (this.mockMode) {
                this.logger.log('[MOCK SMS] ===================================');
                this.logger.log(`To: ${to}`);
                this.logger.log(`Message: ${message}`);
                this.logger.log('==============================================');
                result.success = true;
                result.sentAt = new Date().toISOString();
            }
            else {
                this.logger.warn('SMS API integration not implemented yet - using mock mode');
                result.success = true;
                result.sentAt = new Date().toISOString();
            }
        }
        catch (error) {
            this.logger.error(`Failed to send SMS to ${to}: ${error.message}`, error.stack);
            result.success = false;
            result.errorMessage = error.message;
        }
        return result;
    }
    getOrderConfirmationEmailTemplate(data) {
        const subject = `Order Confirmation - ${data.orderNo}`;
        const itemsHtml = data.items
            .map((item) => `
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
      `)
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
                ${data.discount > 0
            ? `
                <tr>
                  <td style="padding: 5px;">Discount:</td>
                  <td style="padding: 5px; text-align: right; color: #f44336;">-${data.discount.toLocaleString()}원</td>
                </tr>
                `
            : ''}
                <tr style="border-top: 2px solid #ddd; font-weight: bold; font-size: 1.1em;">
                  <td style="padding: 10px 5px;">Total:</td>
                  <td style="padding: 10px 5px; text-align: right; color: #4CAF50;">${data.total.toLocaleString()}원</td>
                </tr>
              </table>
            </div>

            ${data.deliveryAddress
            ? `
            <h2 style="color: #333; margin-top: 30px;">Delivery</h2>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
              <p style="margin: 5px 0;"><strong>Address:</strong> ${data.deliveryAddress}</p>
              ${data.deliveryMemo ? `<p style="margin: 5px 0;"><strong>Note:</strong> ${data.deliveryMemo}</p>` : ''}
            </div>
            `
            : ''}
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
    getOrderStatusUpdateEmailTemplate(data) {
        const subject = `Order Status Update - ${data.orderNo}`;
        const statusMessages = {
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
    getPaymentConfirmationEmailTemplate(data) {
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
    getRefundConfirmationEmailTemplate(data) {
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
    getLowStockAlertEmailTemplate(data) {
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
    getOrderConfirmationSMSTemplate(data) {
        return `[OrderFriends] ${data.customerName}, your order is confirmed. Order No: ${data.orderNo}, Amount: ${data.total.toLocaleString()}원`;
    }
    getOrderReadySMSTemplate(data) {
        const contactInfo = data.branchPhone
            ? ` (Contact: ${data.branchPhone})`
            : '';
        return `[OrderFriends] Order ${data.orderNo} is ready at ${data.branchName}.${contactInfo}`;
    }
    getDeliveryCompleteSMSTemplate(data) {
        return `[OrderFriends] Order ${data.orderNo} has been delivered. Thank you.`;
    }
    async retryNotification(notificationId) {
        this.logger.warn(`Retry notification not implemented yet: ${notificationId}`);
        return {
            success: false,
            type: notification_dto_1.NotificationType.EMAIL,
            recipient: 'unknown',
            errorMessage: 'Retry not implemented',
        };
    }
    async getNotificationStatus(notificationId) {
        this.logger.warn(`Get notification status not implemented yet: ${notificationId}`);
        return null;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map