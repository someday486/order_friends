import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { CashReceiptProvider } from './cash-receipt.types';
import { PopbillCashReceiptsClient } from './popbill-cash-receipts.client';

type CashReceiptBrandDraft = {
  biz_name?: string | null;
  biz_reg_no?: string | null;
  rep_name?: string | null;
  address?: string | null;
  cash_receipt_enabled?: boolean | null;
  cash_receipt_provider?: string | null;
  cash_receipt_merchant_id?: string | null;
  cash_receipt_contact_name?: string | null;
  cash_receipt_contact_phone?: string | null;
};

type ResolvedCashReceiptConfig = {
  cash_receipt_enabled?: boolean | null;
  cash_receipt_provider?: string | null;
  cash_receipt_merchant_id?: string | null;
};

@Injectable()
export class CashReceiptOnboardingService {
  private readonly logger = new Logger(CashReceiptOnboardingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly popbillClient: PopbillCashReceiptsClient,
  ) {}

  async resolveBrandCashReceiptConfig(
    ownerUserId: string,
    draft: CashReceiptBrandDraft,
  ): Promise<ResolvedCashReceiptConfig> {
    const shouldOnboard =
      draft.cash_receipt_enabled === true ||
      this.normalizeProvider(draft.cash_receipt_provider) ===
        CashReceiptProvider.POPBILL;

    if (!shouldOnboard) {
      return {
        cash_receipt_enabled: draft.cash_receipt_enabled ?? false,
        cash_receipt_provider: draft.cash_receipt_provider ?? null,
        cash_receipt_merchant_id: draft.cash_receipt_merchant_id ?? null,
      };
    }

    if (!this.popbillClient.isConfigured()) {
      throw new Error(
        '현금영수증 자동 연동을 위해 POPBILL_LINK_ID와 POPBILL_SECRET_KEY 설정이 필요합니다.',
      );
    }

    const corpNum = this.normalizeDigits(draft.biz_reg_no);
    if (corpNum.length !== 10) {
      throw new Error(
        '현금영수증 자동 연동을 위해 10자리 사업자등록번호가 필요합니다.',
      );
    }

    const corpName = this.requireField(draft.biz_name, '상호');
    const ceoName = this.requireField(draft.rep_name, '대표자명');
    const addr = this.requireField(draft.address, '사업장 주소');
    const contactName = this.requireField(
      draft.cash_receipt_contact_name ?? draft.rep_name,
      '현금영수증 담당자명',
    );
    const contactTel = this.normalizeDigits(draft.cash_receipt_contact_phone);
    if (!contactTel) {
      throw new Error(
        '현금영수증 자동 연동을 위해 담당자 연락처가 필요합니다.',
      );
    }

    const contactEmail = await this.getOwnerEmail(ownerUserId);
    const bizType = process.env.POPBILL_DEFAULT_BIZ_TYPE?.trim() || '서비스업';
    const bizClass =
      process.env.POPBILL_DEFAULT_BIZ_CLASS?.trim() || '전자상거래업';

    this.logger.log(
      `Starting Popbill auto-onboarding check for corpNum ${corpNum}`,
    );

    try {
      const isMember = await this.popbillClient.checkIsMember(corpNum);
      if (!isMember) {
        await this.popbillClient.joinMember({
          LinkID: process.env.POPBILL_LINK_ID || '',
          CorpNum: corpNum,
          CEOName: ceoName,
          CorpName: corpName,
          Addr: addr,
          BizType: bizType,
          BizClass: bizClass,
          ContactName: contactName,
          ContactEmail: contactEmail,
          ContactTEL: contactTel,
          ID: this.buildMemberUserId(corpNum),
          PWD: this.buildMemberPassword(corpNum),
        });
        this.logger.log(`Popbill member joined for corpNum ${corpNum}`);
      } else {
        this.logger.log(`Popbill member already exists for corpNum ${corpNum}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Popbill auto-onboarding failed for corpNum ${corpNum}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`현금영수증 자동 연동에 실패했습니다. ${message}`);
    }

    return {
      cash_receipt_enabled: true,
      cash_receipt_provider: CashReceiptProvider.POPBILL,
      cash_receipt_merchant_id: corpNum,
    };
  }

  private async getOwnerEmail(ownerUserId: string): Promise<string> {
    const admin = this.supabase.adminClient();
    const { data, error } = await admin.auth.admin.getUserById(ownerUserId);

    if (error || !data.user?.email) {
      throw new Error(
        '현금영수증 자동 연동을 위해 브랜드 소유자 이메일이 필요합니다.',
      );
    }

    return data.user.email;
  }

  private requireField(
    value: string | null | undefined,
    label: string,
  ): string {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      throw new Error(`현금영수증 자동 연동을 위해 ${label}이(가) 필요합니다.`);
    }

    return normalized;
  }

  private normalizeProvider(value: string | null | undefined): string | null {
    const normalized = value?.trim().toUpperCase() ?? '';
    return normalized || null;
  }

  private normalizeDigits(value: string | null | undefined): string {
    return value?.replace(/[^\d]/g, '') ?? '';
  }

  private buildMemberUserId(corpNum: string): string {
    return `of${corpNum}`;
  }

  private buildMemberPassword(corpNum: string): string {
    return `OrderFriends!${corpNum}`;
  }
}
