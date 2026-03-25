import { CashReceiptOnboardingService } from './cash-receipt-onboarding.service';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { PopbillCashReceiptsClient } from './popbill-cash-receipts.client';
import { CashReceiptProvider } from './cash-receipt.types';

describe('CashReceiptOnboardingService', () => {
  let service: CashReceiptOnboardingService;
  let mockSupabase: {
    adminClient: jest.Mock;
  };
  let mockPopbillClient: {
    isConfigured: jest.Mock;
    checkIsMember: jest.Mock;
    joinMember: jest.Mock;
  };

  beforeEach(() => {
    mockSupabase = {
      adminClient: jest.fn(() => ({
        auth: {
          admin: {
            getUserById: jest.fn().mockResolvedValue({
              data: { user: { email: 'owner@example.com' } },
              error: null,
            }),
          },
        },
      })),
    };

    mockPopbillClient = {
      isConfigured: jest.fn(() => true),
      checkIsMember: jest.fn(),
      joinMember: jest.fn(),
    };

    service = new CashReceiptOnboardingService(
      mockSupabase as unknown as SupabaseService,
      mockPopbillClient as unknown as PopbillCashReceiptsClient,
    );
    jest.clearAllMocks();
  });

  it('should return existing config when cash receipt is disabled', async () => {
    const result = await service.resolveBrandCashReceiptConfig('user-1', {
      cash_receipt_enabled: false,
      cash_receipt_provider: null,
      cash_receipt_merchant_id: null,
    });

    expect(result).toEqual({
      cash_receipt_enabled: false,
      cash_receipt_provider: null,
      cash_receipt_merchant_id: null,
    });
    expect(mockPopbillClient.checkIsMember).not.toHaveBeenCalled();
  });

  it('should reuse an existing Popbill member', async () => {
    mockPopbillClient.checkIsMember.mockResolvedValueOnce(true);

    const result = await service.resolveBrandCashReceiptConfig('user-1', {
      biz_name: '테스트상호',
      biz_reg_no: '123-45-67890',
      rep_name: '대표자',
      address: '서울시 강남구',
      cash_receipt_enabled: true,
      cash_receipt_provider: CashReceiptProvider.POPBILL,
      cash_receipt_contact_name: '담당자',
      cash_receipt_contact_phone: '010-1234-5678',
    });

    expect(mockPopbillClient.checkIsMember).toHaveBeenCalledWith('1234567890');
    expect(mockPopbillClient.joinMember).not.toHaveBeenCalled();
    expect(result).toEqual({
      cash_receipt_enabled: true,
      cash_receipt_provider: CashReceiptProvider.POPBILL,
      cash_receipt_merchant_id: '1234567890',
    });
  });

  it('should join Popbill when the merchant is not registered yet', async () => {
    mockPopbillClient.checkIsMember.mockResolvedValueOnce(false);
    mockPopbillClient.joinMember.mockResolvedValueOnce({
      code: 1,
      message: 'OK',
    });

    const result = await service.resolveBrandCashReceiptConfig('user-1', {
      biz_name: '테스트상호',
      biz_reg_no: '1234567890',
      rep_name: '대표자',
      address: '서울시 강남구',
      cash_receipt_enabled: true,
      cash_receipt_provider: CashReceiptProvider.POPBILL,
      cash_receipt_contact_name: '담당자',
      cash_receipt_contact_phone: '01012345678',
    });

    expect(mockPopbillClient.joinMember).toHaveBeenCalledWith(
      expect.objectContaining({
        CorpNum: '1234567890',
        CorpName: '테스트상호',
        CEOName: '대표자',
        ContactEmail: 'owner@example.com',
      }),
    );
    expect(result.cash_receipt_merchant_id).toBe('1234567890');
  });

  it('should throw when required contact information is missing', async () => {
    await expect(
      service.resolveBrandCashReceiptConfig('user-1', {
        biz_name: '테스트상호',
        biz_reg_no: '1234567890',
        rep_name: '대표자',
        address: '서울시 강남구',
        cash_receipt_enabled: true,
        cash_receipt_provider: CashReceiptProvider.POPBILL,
        cash_receipt_contact_name: '담당자',
        cash_receipt_contact_phone: null,
      }),
    ).rejects.toThrow('담당자 연락처');
  });
});
