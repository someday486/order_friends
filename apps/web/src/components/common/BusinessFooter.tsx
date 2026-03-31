import Link from 'next/link';

const BUSINESS_INFO = {
  name: '오더프렌즈',
  representative: '김지훈',
  registrationNumber: '204-35-19097',
  address: '서울특별시 은평구 응암로21가길 10-1, 504호(응암동)',
  businessType: '소매업, 서비스업',
  businessItems: '전자상거래 소매 중개업, 광고 대행업',
};

const currentYear = new Date().getFullYear();

export function BusinessFooter() {
  return (
    <footer className="border-t border-border bg-bg-secondary/90">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-6 py-10 text-center text-[13px] leading-6 text-text-secondary">
        <div>
          상호 : {BUSINESS_INFO.name} | 대표 : {BUSINESS_INFO.representative} | 사업자번호 :{' '}
          {BUSINESS_INFO.registrationNumber}
        </div>
        <div>주소 : {BUSINESS_INFO.address}</div>
        <div>
          업태 : {BUSINESS_INFO.businessType} | 종목 : {BUSINESS_INFO.businessItems}
        </div>
        <div className="flex items-center gap-3 text-[13px] text-text-secondary">
          <Link className="underline underline-offset-2 hover:text-text-primary" href="/terms">
            이용약관
          </Link>
          <span>|</span>
          <Link className="underline underline-offset-2 hover:text-text-primary" href="/privacy">
            개인정보처리방침
          </Link>
        </div>
        <div className="text-xs text-text-tertiary">
          © {currentYear} {BUSINESS_INFO.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
