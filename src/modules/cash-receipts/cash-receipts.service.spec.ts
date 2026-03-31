import { CashReceiptsService } from './cash-receipts.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import {
  CASH_RECEIPT_SELF_ISSUE_NUMBER,
  CashReceiptIdentityType,
  CashReceiptProvider,
  CashReceiptStatus,
  CashReceiptType,
} from './cash-receipt.types';
import { PopbillCashReceiptsClient } from './popbill-cash-receipts.client';

describe('CashReceiptsService', () => {
  let service: CashReceiptsService;
  let mockClient: any;
  let mockPopbillClient: {
    isConfigured: jest.Mock;
    issueCashReceipt: jest.Mock;
    getCashReceiptInfo: jest.Mock;
    cancelCashReceipt: jest.Mock;
  };

  const ordersQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  };
  const paymentsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  };
  const branchesQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  };
  const brandsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  };
  const cashReceiptsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    insert: jest.fn(),
    update: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    mockClient = {
      from: jest.fn((table: string) => {
        if (table === 'orders') return ordersQuery;
        if (table === 'payments') return paymentsQuery;
        if (table === 'branches') return branchesQuery;
        if (table === 'brands') return brandsQuery;
        if (table === 'cash_receipts') return cashReceiptsQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const supabase = {
      adminClient: jest.fn(() => mockClient),
    };

    mockPopbillClient = {
      isConfigured: jest.fn(() => true),
      issueCashReceipt: jest.fn(),
      getCashReceiptInfo: jest.fn(),
      cancelCashReceipt: jest.fn(),
    };

    service = new CashReceiptsService(
      supabase as unknown as SupabaseService,
      mockPopbillClient as unknown as PopbillCashReceiptsClient,
    );
    jest.clearAllMocks();
  });

  it('should skip issuance when the order did not request a cash receipt', async () => {
    ordersQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        total_amount: 12000,
        order_no: 'ORD-1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        cash_receipt_requested: false,
      },
      error: null,
    });

    await service.issueForCompletedOrder('order-1');

    expect(paymentsQuery.maybeSingle).not.toHaveBeenCalled();
    expect(cashReceiptsQuery.insert).not.toHaveBeenCalled();
  });

  it('should issue and persist a cash receipt when order and brand are ready', async () => {
    ordersQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        total_amount: 12000,
        order_no: 'ORD-1',
        customer_name: '홍길동',
        customer_phone: '010-1234-5678',
        cash_receipt_requested: true,
        cash_receipt_type: CashReceiptType.INCOME_DEDUCTION,
        cash_receipt_identity_type: CashReceiptIdentityType.PHONE,
        cash_receipt_identity_value: '01012345678',
      },
      error: null,
    });
    paymentsQuery.maybeSingle.mockResolvedValueOnce({
      data: { payment_method: 'TRANSFER', status: 'SUCCESS' },
      error: null,
    });
    branchesQuery.maybeSingle.mockResolvedValueOnce({
      data: { brand_id: 'brand-1' },
      error: null,
    });
    brandsQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'brand-1',
        biz_name: 'Brand Biz',
        biz_reg_no: '1234567890',
        rep_name: '대표자',
        address: '서울시 강남구',
        cash_receipt_enabled: true,
        cash_receipt_provider: CashReceiptProvider.POPBILL,
        cash_receipt_merchant_id: 'of1234567890',
        cash_receipt_issue_timing: 'ORDER_COMPLETED',
        cash_receipt_self_issue_enabled: false,
        cash_receipt_contact_phone: '02-111-2222',
      },
      error: null,
    });
    cashReceiptsQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    cashReceiptsQuery.insert.mockResolvedValueOnce({ error: null });
    mockPopbillClient.issueCashReceipt.mockResolvedValueOnce({
      code: 1,
      message: 'OK',
      confirmNum: 'TB0001234',
      tradeDate: '20260325',
    });
    mockPopbillClient.getCashReceiptInfo.mockResolvedValueOnce({
      itemKey: 'ITEM-1',
      confirmNum: 'TB0001234',
      tradeDate: '20260325',
      issueDT: '20260325153045',
    });
    cashReceiptsQuery.update.mockReturnValueOnce(cashReceiptsQuery);
    cashReceiptsQuery.eq
      .mockReturnValueOnce(cashReceiptsQuery)
      .mockResolvedValueOnce({ error: null });

    await service.issueForCompletedOrder('order-1');

    expect(cashReceiptsQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: 'order-1',
        brand_id: 'brand-1',
        branch_id: 'branch-1',
        provider: CashReceiptProvider.POPBILL,
        status: CashReceiptStatus.REQUESTED,
        issue_type: CashReceiptType.INCOME_DEDUCTION,
        identity_type: CashReceiptIdentityType.PHONE,
        identity_value_masked: '010****5678',
      }),
    );
    expect(mockPopbillClient.issueCashReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        corpNum: '1234567890',
        userId: 'of1234567890',
        cashbill: expect.objectContaining({
          tradeUsage: '소득공제용',
          taxationType: '과세',
        }),
      }),
    );
    expect(cashReceiptsQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CashReceiptStatus.ISSUED,
        receipt_key: 'ITEM-1',
        approval_no: 'TB0001234',
      }),
    );
  });

  it('should create a failed receipt row when provider config is missing', async () => {
    ordersQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        total_amount: 12000,
        order_no: 'ORD-1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        cash_receipt_requested: true,
        cash_receipt_type: CashReceiptType.EXPENSE_PROOF,
        cash_receipt_identity_type: CashReceiptIdentityType.BUSINESS_NUMBER,
        cash_receipt_identity_value: '1234567890',
      },
      error: null,
    });
    paymentsQuery.maybeSingle.mockResolvedValueOnce({
      data: { payment_method: 'TRANSFER', status: 'SUCCESS' },
      error: null,
    });
    branchesQuery.maybeSingle.mockResolvedValueOnce({
      data: { brand_id: 'brand-1' },
      error: null,
    });
    brandsQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'brand-1',
        biz_name: 'Brand Biz',
        biz_reg_no: '1234567890',
        rep_name: null,
        address: null,
        cash_receipt_enabled: true,
        cash_receipt_provider: null,
        cash_receipt_merchant_id: null,
        cash_receipt_issue_timing: 'ORDER_COMPLETED',
        cash_receipt_self_issue_enabled: false,
        cash_receipt_contact_phone: null,
      },
      error: null,
    });
    cashReceiptsQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    cashReceiptsQuery.insert.mockResolvedValueOnce({ error: null });

    await service.issueForCompletedOrder('order-1');

    expect(cashReceiptsQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CashReceiptStatus.FAILED,
        error_code: 'PROVIDER_NOT_CONFIGURED',
      }),
    );
  });

  it('should use self-issue number with income deduction when identity is missing', async () => {
    ordersQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'order-1',
        branch_id: 'branch-1',
        total_amount: 11000,
        order_no: 'ORD-1',
        customer_name: '홍길동',
        customer_phone: '01012345678',
        cash_receipt_requested: true,
        cash_receipt_type: CashReceiptType.EXPENSE_PROOF,
        cash_receipt_identity_type: null,
        cash_receipt_identity_value: null,
      },
      error: null,
    });
    paymentsQuery.maybeSingle.mockResolvedValueOnce({
      data: { payment_method: 'TRANSFER', status: 'SUCCESS' },
      error: null,
    });
    branchesQuery.maybeSingle.mockResolvedValueOnce({
      data: { brand_id: 'brand-1' },
      error: null,
    });
    brandsQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'brand-1',
        biz_name: 'Brand Biz',
        biz_reg_no: '1234567890',
        rep_name: null,
        address: null,
        cash_receipt_enabled: true,
        cash_receipt_provider: CashReceiptProvider.POPBILL,
        cash_receipt_merchant_id: null,
        cash_receipt_issue_timing: 'ORDER_COMPLETED',
        cash_receipt_self_issue_enabled: true,
        cash_receipt_contact_phone: null,
      },
      error: null,
    });
    cashReceiptsQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    cashReceiptsQuery.insert.mockResolvedValueOnce({ error: null });
    mockPopbillClient.issueCashReceipt.mockResolvedValueOnce({
      code: 1,
      message: 'OK',
      confirmNum: 'TB0001234',
      tradeDate: '20260325',
    });
    mockPopbillClient.getCashReceiptInfo.mockResolvedValueOnce({
      itemKey: 'ITEM-1',
      confirmNum: 'TB0001234',
      tradeDate: '20260325',
    });
    cashReceiptsQuery.update.mockReturnValueOnce(cashReceiptsQuery);
    cashReceiptsQuery.eq
      .mockReturnValueOnce(cashReceiptsQuery)
      .mockResolvedValueOnce({ error: null });

    await service.issueForCompletedOrder('order-1');

    expect(mockPopbillClient.issueCashReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        cashbill: expect.objectContaining({
          tradeUsage: '소득공제용',
          identityNum: CASH_RECEIPT_SELF_ISSUE_NUMBER,
        }),
      }),
    );
  });

  it('should cancel issued receipts through Popbill', async () => {
    cashReceiptsQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'receipt-1',
        brand_id: 'brand-1',
        provider: CashReceiptProvider.POPBILL,
        status: CashReceiptStatus.ISSUED,
        receipt_key: 'ITEM-1',
        approval_no: 'TB0001234',
        issued_at: '2026-03-25T06:30:45.000Z',
        request_payload: {},
        response_payload: {
          issue: {
            tradeDate: '20260325',
          },
        },
      },
      error: null,
    });
    brandsQuery.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'brand-1',
        biz_name: 'Brand Biz',
        biz_reg_no: '1234567890',
        rep_name: null,
        address: null,
        cash_receipt_enabled: true,
        cash_receipt_provider: CashReceiptProvider.POPBILL,
        cash_receipt_merchant_id: 'merchant-user',
        cash_receipt_issue_timing: 'ORDER_COMPLETED',
        cash_receipt_self_issue_enabled: false,
        cash_receipt_contact_phone: null,
      },
      error: null,
    });
    mockPopbillClient.cancelCashReceipt.mockResolvedValueOnce({
      code: 1,
      message: 'OK',
      confirmNum: 'TB0009999',
      tradeDate: '20260325',
    });
    cashReceiptsQuery.update.mockReturnValueOnce(cashReceiptsQuery);
    cashReceiptsQuery.eq
      .mockReturnValueOnce(cashReceiptsQuery)
      .mockResolvedValueOnce({ error: null });

    await service.cancelForOrder('order-1', 'Order cancelled');

    expect(mockPopbillClient.cancelCashReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        corpNum: '1234567890',
        userId: 'merchant-user',
        orgConfirmNum: 'TB0001234',
        orgTradeDate: '20260325',
      }),
    );
    expect(cashReceiptsQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CashReceiptStatus.CANCELLED,
      }),
    );
  });

  it('should derive a Popbill member userId for legacy numeric merchant ids', () => {
    expect(
      (service as any).resolveProviderAccount({
        biz_reg_no: '123-45-67890',
        cash_receipt_merchant_id: '1234567890',
      }),
    ).toEqual({
      corpNum: '1234567890',
      userId: 'of1234567890',
    });
  });
});
