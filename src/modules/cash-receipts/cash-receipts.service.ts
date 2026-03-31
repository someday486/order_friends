import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  CASH_RECEIPT_SELF_ISSUE_NUMBER,
  CashReceiptIdentityType,
  CashReceiptIssueTiming,
  CashReceiptProvider,
  CashReceiptStatus,
  CashReceiptType,
} from './cash-receipt.types';
import {
  PopbillCashbillInfo,
  PopbillCashReceiptsClient,
} from './popbill-cash-receipts.client';

type ReceiptReadyOrder = {
  id: string;
  branch_id: string;
  total_amount: number | null;
  order_no: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  cash_receipt_requested: boolean | null;
  cash_receipt_type: string | null;
  cash_receipt_identity_type: string | null;
  cash_receipt_identity_value: string | null;
};

type BrandReceiptSettings = {
  id: string;
  biz_name: string | null;
  biz_reg_no: string | null;
  rep_name: string | null;
  address: string | null;
  cash_receipt_enabled: boolean | null;
  cash_receipt_provider: string | null;
  cash_receipt_merchant_id: string | null;
  cash_receipt_issue_timing: string | null;
  cash_receipt_self_issue_enabled: boolean | null;
  cash_receipt_contact_phone: string | null;
};

type ExistingCashReceipt = {
  id: string;
  brand_id: string;
  provider: string | null;
  status: string | null;
  receipt_key: string | null;
  approval_no: string | null;
  issued_at: string | null;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
};

@Injectable()
export class CashReceiptsService {
  private readonly logger = new Logger(CashReceiptsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly popbillClient: PopbillCashReceiptsClient,
  ) {}

  async issueForCompletedOrder(orderId: string): Promise<void> {
    const order = await this.getOrder(orderId);
    if (!order?.cash_receipt_requested) {
      return;
    }

    const payment = await this.getPayment(orderId);
    if (!payment) {
      return;
    }

    if (payment.payment_method !== 'TRANSFER' || payment.status !== 'SUCCESS') {
      return;
    }

    const branch = await this.getBranch(order.branch_id);
    if (!branch?.brand_id) {
      return;
    }

    const brand = await this.getBrand(branch.brand_id);
    if (!brand?.cash_receipt_enabled) {
      return;
    }

    if (
      brand.cash_receipt_issue_timing &&
      brand.cash_receipt_issue_timing !== CashReceiptIssueTiming.ORDER_COMPLETED
    ) {
      return;
    }

    const existingReceipt = await this.getActiveReceipt(orderId);
    if (existingReceipt) {
      return;
    }

    const normalized = this.normalizeReceiptRequest(order, brand);
    if (!normalized) {
      await this.insertFailedReceipt(order, brand, 'IDENTITY_REQUIRED');
      return;
    }

    if ((order.total_amount ?? 0) <= 0) {
      await this.insertFailedReceipt(
        order,
        brand,
        'INVALID_AMOUNT',
        normalized,
      );
      return;
    }

    const provider = this.normalizeProvider(brand.cash_receipt_provider);
    if (!provider) {
      await this.insertFailedReceipt(
        order,
        brand,
        'PROVIDER_NOT_CONFIGURED',
        normalized,
      );
      return;
    }

    if (provider !== CashReceiptProvider.POPBILL) {
      await this.insertFailedReceipt(
        order,
        brand,
        'UNSUPPORTED_PROVIDER',
        normalized,
      );
      return;
    }

    if (!this.popbillClient.isConfigured()) {
      await this.insertFailedReceipt(
        order,
        brand,
        'POPBILL_CREDENTIALS_NOT_CONFIGURED',
        normalized,
      );
      return;
    }

    const providerAccount = this.resolveProviderAccount(brand);
    if (!providerAccount) {
      await this.insertFailedReceipt(
        order,
        brand,
        'MERCHANT_CORP_NUM_REQUIRED',
        normalized,
      );
      return;
    }

    const amountBreakdown = this.calculateAmountBreakdown(
      order.total_amount ?? 0,
    );
    const mgtKey = this.buildIssueMgtKey(order.id);
    const cashbill = {
      mgtKey,
      tradeType: '승인거래' as const,
      tradeUsage: this.mapTradeUsage(normalized.type),
      tradeOpt: this.resolveTradeOption(),
      taxationType: amountBreakdown.taxationType,
      identityNum: normalized.identityValue,
      franchiseCorpNum: providerAccount.corpNum,
      franchiseCorpName: brand.biz_name ?? undefined,
      franchiseCEOName: brand.rep_name ?? undefined,
      franchiseAddr: brand.address ?? undefined,
      franchiseTEL:
        this.normalizeDigits(brand.cash_receipt_contact_phone) || undefined,
      customerName: order.customer_name ?? undefined,
      itemName: this.buildItemName(order),
      orderNumber: order.order_no ?? order.id,
      hp: this.normalizeDigits(order.customer_phone) || undefined,
      supplyCost: String(amountBreakdown.supplyCost),
      tax: String(amountBreakdown.tax),
      serviceFee: '0',
      totalAmount: String(order.total_amount ?? 0),
    };
    const requestPayload = {
      provider,
      corpNum: providerAccount.corpNum,
      userId: providerAccount.userId ?? null,
      ...cashbill,
    };

    const receiptId = randomUUID();
    await this.insertRequestedReceipt(
      receiptId,
      order,
      brand,
      provider,
      normalized,
      requestPayload,
    );

    try {
      const issued = await this.popbillClient.issueCashReceipt({
        corpNum: providerAccount.corpNum,
        userId: providerAccount.userId,
        memo: `Order ${order.order_no ?? order.id}`,
        cashbill,
      });
      const info = await this.getPopbillInfoSafely(
        providerAccount.corpNum,
        mgtKey,
        providerAccount.userId,
      );

      await this.updateReceipt(receiptId, {
        status: CashReceiptStatus.ISSUED,
        receipt_key: info?.itemKey ?? mgtKey,
        approval_no: issued.confirmNum ?? info?.confirmNum ?? null,
        issued_at: this.toIsoDatetime(
          info?.issueDT ??
            info?.tradeDT ??
            info?.regDT ??
            info?.stateDT ??
            issued.tradeDate,
        ),
        response_payload: {
          issue: issued,
          info: info ?? null,
        },
        error_code: null,
        error_message: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        error instanceof Error && 'code' in error
          ? String((error as Error & { code?: string }).code ?? 'POPBILL_ERROR')
          : 'POPBILL_ERROR';

      this.logger.error(
        `Cash receipt issue failed for order ${order.id}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.updateReceipt(receiptId, {
        status: CashReceiptStatus.FAILED,
        response_payload: {
          issue: null,
        },
        error_code: code,
        error_message: message,
      });
    }
  }

  async cancelForOrder(orderId: string, reason?: string): Promise<void> {
    const existing = await this.getReceiptForCancellation(orderId);
    if (!existing) {
      return;
    }

    if (existing.status !== CashReceiptStatus.ISSUED) {
      return;
    }

    const provider = this.normalizeProvider(existing.provider);
    if (provider !== CashReceiptProvider.POPBILL) {
      await this.markCancelRequested(
        existing.id,
        reason ?? 'Unsupported cash receipt provider for cancellation',
        existing.response_payload,
      );
      return;
    }

    if (!this.popbillClient.isConfigured()) {
      await this.markCancelRequested(
        existing.id,
        reason ?? 'Popbill credentials are not configured',
        existing.response_payload,
      );
      return;
    }

    const brand = await this.getBrand(existing.brand_id);
    if (!brand) {
      await this.markCancelRequested(
        existing.id,
        'Brand not found',
        existing.response_payload,
      );
      return;
    }

    const providerAccount = this.resolveProviderAccount(brand);
    if (!providerAccount) {
      await this.markCancelRequested(
        existing.id,
        'Merchant corp num is missing',
        existing.response_payload,
      );
      return;
    }

    const originalTradeDate = this.extractTradeDate(existing);
    const originalConfirmNum = existing.approval_no?.trim() ?? '';
    if (!originalTradeDate || !originalConfirmNum) {
      await this.markCancelRequested(
        existing.id,
        'Original cash receipt confirmation info is missing',
        existing.response_payload,
      );
      return;
    }

    const cancelMgtKey = this.buildCancelMgtKey(existing.id);

    try {
      const cancelled = await this.popbillClient.cancelCashReceipt({
        corpNum: providerAccount.corpNum,
        userId: providerAccount.userId,
        mgtKey: cancelMgtKey,
        orgConfirmNum: originalConfirmNum,
        orgTradeDate: originalTradeDate,
        memo: reason ?? `Cancel order ${orderId}`,
      });

      await this.updateReceipt(existing.id, {
        status: CashReceiptStatus.CANCELLED,
        cancelled_at: new Date().toISOString(),
        response_payload: {
          ...(existing.response_payload ?? {}),
          cancel: {
            mgtKey: cancelMgtKey,
            response: cancelled,
          },
        },
        error_code: null,
        error_message: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Cash receipt cancel failed for order ${orderId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.markCancelRequested(
        existing.id,
        message,
        existing.response_payload,
        {
          cancel: {
            mgtKey: cancelMgtKey,
          },
        },
      );
    }
  }

  private async getOrder(orderId: string): Promise<ReceiptReadyOrder | null> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('orders')
      .select(
        'id, branch_id, total_amount, order_no, customer_name, customer_phone, cash_receipt_requested, cash_receipt_type, cash_receipt_identity_type, cash_receipt_identity_value',
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to load order for cash receipt: ${error.message}`,
      );
    }

    return (data as ReceiptReadyOrder | null) ?? null;
  }

  private async getPayment(orderId: string): Promise<{
    payment_method: string | null;
    status: string | null;
  } | null> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('payments')
      .select('payment_method, status')
      .eq('order_id', orderId)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to load payment for cash receipt: ${error.message}`,
      );
    }

    return data ?? null;
  }

  private async getBranch(
    branchId: string,
  ): Promise<{ brand_id: string | null } | null> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('branches')
      .select('brand_id')
      .eq('id', branchId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to load branch for cash receipt: ${error.message}`,
      );
    }

    return data ?? null;
  }

  private async getBrand(
    brandId: string,
  ): Promise<BrandReceiptSettings | null> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('brands')
      .select(
        'id, biz_name, biz_reg_no, rep_name, address, cash_receipt_enabled, cash_receipt_provider, cash_receipt_merchant_id, cash_receipt_issue_timing, cash_receipt_self_issue_enabled, cash_receipt_contact_phone',
      )
      .eq('id', brandId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to load brand for cash receipt: ${error.message}`,
      );
    }

    return (data as BrandReceiptSettings | null) ?? null;
  }

  private async getActiveReceipt(
    orderId: string,
  ): Promise<{ id: string } | null> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('cash_receipts')
      .select('id')
      .eq('order_id', orderId)
      .in('status', [
        CashReceiptStatus.REQUESTED,
        CashReceiptStatus.ISSUED,
        CashReceiptStatus.CANCEL_REQUESTED,
      ])
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load existing cash receipt: ${error.message}`);
    }

    return data ?? null;
  }

  private async getReceiptForCancellation(
    orderId: string,
  ): Promise<ExistingCashReceipt | null> {
    const sb = this.supabase.adminClient();
    const { data, error } = await sb
      .from('cash_receipts')
      .select(
        'id, brand_id, provider, status, receipt_key, approval_no, issued_at, request_payload, response_payload',
      )
      .eq('order_id', orderId)
      .in('status', [
        CashReceiptStatus.ISSUED,
        CashReceiptStatus.CANCEL_REQUESTED,
      ])
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to load cash receipt for cancel: ${error.message}`,
      );
    }

    return (data as ExistingCashReceipt | null) ?? null;
  }

  private normalizeReceiptRequest(
    order: ReceiptReadyOrder,
    brand: BrandReceiptSettings,
  ): {
    type: CashReceiptType;
    identityType: CashReceiptIdentityType;
    identityValue: string;
  } | null {
    const type =
      order.cash_receipt_type === CashReceiptType.EXPENSE_PROOF
        ? CashReceiptType.EXPENSE_PROOF
        : CashReceiptType.INCOME_DEDUCTION;

    const identityType = this.toIdentityType(order.cash_receipt_identity_type);
    const identityValue = this.normalizeIdentityValue(
      identityType,
      order.cash_receipt_identity_value,
    );

    if (identityType && identityValue) {
      return {
        type:
          identityType === CashReceiptIdentityType.SELF_ISSUE
            ? CashReceiptType.INCOME_DEDUCTION
            : type,
        identityType,
        identityValue,
      };
    }

    if (brand.cash_receipt_self_issue_enabled) {
      return {
        type: CashReceiptType.INCOME_DEDUCTION,
        identityType: CashReceiptIdentityType.SELF_ISSUE,
        identityValue: CASH_RECEIPT_SELF_ISSUE_NUMBER,
      };
    }

    return null;
  }

  private toIdentityType(value: string | null): CashReceiptIdentityType | null {
    if (
      value === CashReceiptIdentityType.PHONE ||
      value === CashReceiptIdentityType.BUSINESS_NUMBER ||
      value === CashReceiptIdentityType.CARD_NUMBER ||
      value === CashReceiptIdentityType.SELF_ISSUE
    ) {
      return value;
    }

    return null;
  }

  private normalizeIdentityValue(
    identityType: CashReceiptIdentityType | null,
    value: string | null,
  ): string {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
      return '';
    }

    if (!identityType) {
      return raw;
    }

    if (
      identityType === CashReceiptIdentityType.PHONE ||
      identityType === CashReceiptIdentityType.BUSINESS_NUMBER ||
      identityType === CashReceiptIdentityType.CARD_NUMBER ||
      identityType === CashReceiptIdentityType.SELF_ISSUE
    ) {
      return raw.replace(/[^\d]/g, '');
    }

    return raw;
  }

  private async insertFailedReceipt(
    order: ReceiptReadyOrder,
    brand: BrandReceiptSettings,
    reason: string,
    normalized?: {
      type: CashReceiptType;
      identityType: CashReceiptIdentityType;
      identityValue: string;
    } | null,
  ): Promise<void> {
    const sb = this.supabase.adminClient();
    const { error } = await sb.from('cash_receipts').insert({
      order_id: order.id,
      brand_id: brand.id,
      branch_id: order.branch_id,
      provider: brand.cash_receipt_provider ?? 'UNCONFIGURED',
      status: CashReceiptStatus.FAILED,
      issue_type: normalized?.type ?? CashReceiptType.INCOME_DEDUCTION,
      identity_type:
        normalized?.identityType ?? CashReceiptIdentityType.SELF_ISSUE,
      identity_value_masked: normalized
        ? this.maskIdentity(normalized.identityType, normalized.identityValue)
        : null,
      identity_value_encrypted: normalized?.identityValue ?? null,
      request_payload: {
        orderId: order.order_no ?? order.id,
      },
      response_payload: {},
      error_code: reason,
      error_message: reason,
    });

    if (error) {
      throw new Error(
        `Failed to create failed cash receipt row: ${error.message}`,
      );
    }
  }

  private async insertRequestedReceipt(
    receiptId: string,
    order: ReceiptReadyOrder,
    brand: BrandReceiptSettings,
    provider: CashReceiptProvider,
    normalized: {
      type: CashReceiptType;
      identityType: CashReceiptIdentityType;
      identityValue: string;
    },
    requestPayload: Record<string, unknown>,
  ): Promise<void> {
    const sb = this.supabase.adminClient();
    const { error } = await sb.from('cash_receipts').insert({
      id: receiptId,
      order_id: order.id,
      brand_id: brand.id,
      branch_id: order.branch_id,
      provider,
      status: CashReceiptStatus.REQUESTED,
      issue_type: normalized.type,
      identity_type: normalized.identityType,
      identity_value_masked: this.maskIdentity(
        normalized.identityType,
        normalized.identityValue,
      ),
      identity_value_encrypted: normalized.identityValue,
      request_payload: requestPayload,
      response_payload: {},
    });

    if (error) {
      throw new Error(
        `Failed to create cash receipt request: ${error.message}`,
      );
    }
  }

  private async updateReceipt(
    receiptId: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const sb = this.supabase.adminClient();
    const { error } = await sb
      .from('cash_receipts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', receiptId);

    if (error) {
      throw new Error(`Failed to update cash receipt: ${error.message}`);
    }
  }

  private async markCancelRequested(
    receiptId: string,
    message: string,
    currentResponsePayload?: Record<string, unknown> | null,
    extraResponsePayload?: Record<string, unknown>,
  ): Promise<void> {
    await this.updateReceipt(receiptId, {
      status: CashReceiptStatus.CANCEL_REQUESTED,
      cancelled_at: new Date().toISOString(),
      response_payload: {
        ...(currentResponsePayload ?? {}),
        ...(extraResponsePayload ?? {}),
      },
      error_message: message,
    });
  }

  private normalizeProvider(value: string | null): CashReceiptProvider | null {
    const normalized =
      typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (normalized === CashReceiptProvider.POPBILL) {
      return CashReceiptProvider.POPBILL;
    }

    return null;
  }

  private resolveProviderAccount(
    brand: BrandReceiptSettings,
  ): { corpNum: string; userId?: string } | null {
    const merchantId = brand.cash_receipt_merchant_id?.trim() ?? '';
    const bizRegNo = this.normalizeDigits(brand.biz_reg_no);

    if (/^\d{10}$/.test(merchantId)) {
      return {
        corpNum: merchantId,
        userId:
          bizRegNo === merchantId
            ? this.buildMemberUserId(merchantId)
            : undefined,
      };
    }

    if (bizRegNo.length !== 10) {
      return null;
    }

    return {
      corpNum: bizRegNo,
      userId: merchantId || undefined,
    };
  }

  private buildMemberUserId(corpNum: string): string {
    return `of${corpNum}`;
  }

  private calculateAmountBreakdown(totalAmount: number): {
    taxationType: '과세' | '비과세';
    supplyCost: number;
    tax: number;
  } {
    const taxationType =
      process.env.CASH_RECEIPT_TAXATION_TYPE === '비과세' ? '비과세' : '과세';

    if (taxationType === '비과세') {
      return {
        taxationType,
        supplyCost: totalAmount,
        tax: 0,
      };
    }

    const tax = Math.round(totalAmount / 11);
    return {
      taxationType,
      supplyCost: totalAmount - tax,
      tax,
    };
  }

  private resolveTradeOption(): '일반' | '도서공연' | '대중교통' {
    const raw = process.env.CASH_RECEIPT_TRADE_OPT;
    if (raw === '도서공연' || raw === '대중교통') {
      return raw;
    }

    return '일반';
  }

  private mapTradeUsage(type: CashReceiptType): '소득공제용' | '지출증빙용' {
    return type === CashReceiptType.EXPENSE_PROOF ? '지출증빙용' : '소득공제용';
  }

  private buildIssueMgtKey(orderId: string): string {
    return this.buildMgtKey('cr', orderId);
  }

  private buildCancelMgtKey(receiptId: string): string {
    return this.buildMgtKey('cc', receiptId);
  }

  private buildMgtKey(prefix: string, source: string): string {
    return `${prefix}_${createHash('sha1').update(source).digest('hex').slice(0, 21)}`;
  }

  private buildItemName(order: ReceiptReadyOrder): string {
    return `Order ${order.order_no ?? order.id}`;
  }

  private normalizeDigits(value: string | null | undefined): string {
    return typeof value === 'string' ? value.replace(/[^\d]/g, '') : '';
  }

  private async getPopbillInfoSafely(
    corpNum: string,
    mgtKey: string,
    userId?: string,
  ): Promise<PopbillCashbillInfo | null> {
    try {
      return await this.popbillClient.getCashReceiptInfo(
        corpNum,
        mgtKey,
        userId,
      );
    } catch (error) {
      this.logger.warn(
        `Cash receipt info lookup failed for mgtKey ${mgtKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private extractTradeDate(existing: ExistingCashReceipt): string | null {
    const issue = existing.response_payload?.issue;
    if (issue && typeof issue === 'object') {
      const tradeDate = this.readRecordString(
        issue as Record<string, unknown>,
        'tradeDate',
      );
      if (/^\d{8}$/.test(tradeDate)) {
        return tradeDate;
      }
    }

    const info = existing.response_payload?.info;
    if (info && typeof info === 'object') {
      const tradeDate = this.readRecordString(
        info as Record<string, unknown>,
        'tradeDate',
      );
      if (/^\d{8}$/.test(tradeDate)) {
        return tradeDate;
      }
    }

    if (existing.issued_at) {
      return existing.issued_at.slice(0, 10).replace(/-/g, '');
    }

    return null;
  }

  private toIsoDatetime(value: unknown): string | null {
    if (typeof value !== 'string' || !value) {
      return null;
    }

    if (/^\d{14}$/.test(value)) {
      const isoValue = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+09:00`;
      const date = new Date(isoValue);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    if (/^\d{8}$/.test(value)) {
      const isoValue = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00+09:00`;
      const date = new Date(isoValue);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private readRecordString(
    record: Record<string, unknown>,
    key: string,
  ): string {
    const value = record[key];
    return typeof value === 'string' ? value : '';
  }

  private maskIdentity(
    identityType: CashReceiptIdentityType,
    identityValue: string,
  ): string {
    const normalized = identityValue.replace(/\s+/g, '');
    if (normalized.length <= 4) {
      return normalized;
    }

    if (identityType === CashReceiptIdentityType.PHONE) {
      return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
    }

    if (identityType === CashReceiptIdentityType.BUSINESS_NUMBER) {
      return `${normalized.slice(0, 3)}*****${normalized.slice(-2)}`;
    }

    return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`;
  }
}
