import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type PopbillCashbillService = {
  checkIsMember(
    corpNum: string,
    success: (response: boolean) => void,
    error: (error: PopbillErrorLike) => void,
  ): void;
  joinMember(
    joinForm: Record<string, string>,
    success: (response: PopbillIssueResponse) => void,
    error: (error: PopbillErrorLike) => void,
  ): void;
  registIssue(
    corpNum: string,
    cashbill: Record<string, unknown>,
    memo: string,
    userId: string,
    emailSubject: string,
    success: (response: PopbillIssueResponse) => void,
    error: (error: PopbillErrorLike) => void,
  ): void;
  getInfo(
    corpNum: string,
    mgtKey: string,
    userId: string,
    success: (response: PopbillCashbillInfo) => void,
    error: (error: PopbillErrorLike) => void,
  ): void;
  revokeRegistIssue(
    corpNum: string,
    mgtKey: string,
    orgConfirmNum: string,
    orgTradeDate: string,
    smssendYN: boolean,
    memo: string,
    userId: string,
    isPartCancel: boolean,
    cancelType: number,
    supplyCost: string,
    tax: string,
    serviceFee: string,
    totalAmount: string,
    emailSubject: string,
    tradeDT: string,
    success: (response: PopbillIssueResponse) => void,
    error: (error: PopbillErrorLike) => void,
  ): void;
};

type PopbillErrorLike = {
  code?: string | number;
  message?: string;
};

type PopbillSdkModule = {
  config(options: { LinkID: string; SecretKey: string; IsTest: boolean }): void;
  CashbillService(): PopbillCashbillService;
};

export type PopbillIssueRequest = {
  corpNum: string;
  userId?: string;
  memo: string;
  cashbill: {
    mgtKey: string;
    tradeType: '승인거래' | '취소거래';
    tradeUsage: '소득공제용' | '지출증빙용';
    tradeOpt: '일반' | '도서공연' | '대중교통';
    taxationType: '과세' | '비과세';
    identityNum: string;
    franchiseCorpNum: string;
    franchiseCorpName?: string;
    franchiseCEOName?: string;
    franchiseAddr?: string;
    franchiseTEL?: string;
    customerName?: string;
    itemName?: string;
    orderNumber?: string;
    hp?: string;
    supplyCost: string;
    tax: string;
    serviceFee: string;
    totalAmount: string;
  };
};

export type PopbillIssueResponse = {
  code: number;
  message: string;
  confirmNum?: string;
  tradeDate?: string;
};

export type PopbillCashbillInfo = {
  itemKey?: string;
  mgtKey?: string;
  tradeDate?: string;
  tradeDT?: string;
  issueDT?: string;
  regDT?: string;
  stateDT?: string;
  stateCode?: number;
  confirmNum?: string;
  ntsresultCode?: string;
  ntsresultMessage?: string;
};

export type PopbillCancelRequest = {
  corpNum: string;
  userId?: string;
  mgtKey: string;
  orgConfirmNum: string;
  orgTradeDate: string;
  memo: string;
};

@Injectable()
export class PopbillCashReceiptsClient {
  private readonly logger = new Logger(PopbillCashReceiptsClient.name);
  private readonly linkId: string;
  private readonly secretKey: string;
  private readonly isTest: boolean;
  private readonly enabled: boolean;
  private readonly cashbillService: PopbillCashbillService | null;

  constructor(private readonly configService: ConfigService) {
    this.linkId = this.configService.get<string>('POPBILL_LINK_ID') || '';
    this.secretKey = this.configService.get<string>('POPBILL_SECRET_KEY') || '';

    const rawIsTest = this.configService.get<string>('POPBILL_IS_TEST');
    this.isTest =
      rawIsTest !== undefined
        ? rawIsTest === 'true'
        : process.env.NODE_ENV !== 'production';

    this.enabled = !!this.linkId && !!this.secretKey;
    this.cashbillService = this.enabled ? this.configureSdk() : null;

    if (!this.enabled) {
      this.logger.warn(
        'Popbill cash receipt client is disabled (set POPBILL_LINK_ID and POPBILL_SECRET_KEY to enable live issuance).',
      );
    }
  }

  isConfigured(): boolean {
    return this.enabled && this.cashbillService !== null;
  }

  async checkIsMember(corpNum: string): Promise<boolean> {
    const service = this.getService();

    return this.wrap<boolean>((success, error) =>
      service.checkIsMember(corpNum, success, error),
    );
  }

  async joinMember(
    joinForm: Record<string, string>,
  ): Promise<PopbillIssueResponse> {
    const service = this.getService();

    return this.wrap<PopbillIssueResponse>((success, error) =>
      service.joinMember(joinForm, success, error),
    );
  }

  async issueCashReceipt(
    request: PopbillIssueRequest,
  ): Promise<PopbillIssueResponse> {
    const service = this.getService();

    return this.wrap<PopbillIssueResponse>((success, error) =>
      service.registIssue(
        request.corpNum,
        request.cashbill,
        request.memo,
        request.userId ?? '',
        '',
        success,
        error,
      ),
    );
  }

  async getCashReceiptInfo(
    corpNum: string,
    mgtKey: string,
    userId?: string,
  ): Promise<PopbillCashbillInfo> {
    const service = this.getService();

    return this.wrap<PopbillCashbillInfo>((success, error) =>
      service.getInfo(corpNum, mgtKey, userId ?? '', success, error),
    );
  }

  async cancelCashReceipt(
    request: PopbillCancelRequest,
  ): Promise<PopbillIssueResponse> {
    const service = this.getService();

    return this.wrap<PopbillIssueResponse>((success, error) =>
      service.revokeRegistIssue(
        request.corpNum,
        request.mgtKey,
        request.orgConfirmNum,
        request.orgTradeDate,
        false,
        request.memo,
        request.userId ?? '',
        false,
        1,
        '',
        '',
        '',
        '',
        '',
        '',
        success,
        error,
      ),
    );
  }

  private configureSdk(): PopbillCashbillService | null {
    const popbill = this.loadSdkModule();
    if (!popbill) {
      return null;
    }

    popbill.config({
      LinkID: this.linkId,
      SecretKey: this.secretKey,
      IsTest: this.isTest,
    });

    return popbill.CashbillService();
  }

  private loadSdkModule(): PopbillSdkModule | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const loaded = require('popbill') as
        | PopbillSdkModule
        | {
            default?: PopbillSdkModule;
          };
      if ('default' in loaded && loaded.default) {
        return loaded.default;
      }

      return loaded as PopbillSdkModule;
    } catch (error) {
      const isMissingModule =
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' &&
        /Cannot find module ['"]popbill['"]/.test(error.message);

      if (isMissingModule) {
        this.logger.warn(
          'Popbill cash receipt client is unavailable because the "popbill" package is not installed.',
        );
        return null;
      }

      throw error;
    }
  }

  private getService(): PopbillCashbillService {
    if (!this.cashbillService) {
      throw new Error('Popbill cash receipt client is not configured');
    }

    return this.cashbillService;
  }

  private wrap<T>(
    executor: (
      success: (response: T) => void,
      error: (error: PopbillErrorLike) => void,
    ) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      executor(
        (response) => resolve(response),
        (error) => reject(this.toError(error)),
      );
    });
  }

  private toError(error: PopbillErrorLike): Error {
    const code =
      error?.code !== undefined && error?.code !== null
        ? String(error.code)
        : 'UNKNOWN';
    const message = error?.message || 'Unknown Popbill error';
    const wrapped = new Error(`[${code}] ${message}`) as Error & {
      code?: string;
    };
    wrapped.code = code;
    return wrapped;
  }
}
