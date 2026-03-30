declare module 'popbill' {
  type PopbillErrorLike = {
    code?: string | number;
    message?: string;
  };

  type PopbillIssueResponse = {
    code: number;
    message: string;
    confirmNum?: string;
    tradeDate?: string;
  };

  type PopbillCashbillInfo = {
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

  interface PopbillCashbillService {
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
  }

  interface PopbillSdk {
    config(config: Record<string, unknown>): void;
    CashbillService(): PopbillCashbillService;
  }

  const popbill: PopbillSdk;
  export default popbill;
}
