const BUSINESS_INFO = {
  name: '오더프렌즈',
  representative: '김지훈',
  registrationNumber: '204-35-19097',
  address: '서울특별시 은평구 응암로21가길 10-1, 504호(응암동)',
  businessType: '소매업, 서비스업',
  businessItems: '전자상거래 소매 중개업, 광고 대행업',
};

export function BusinessFooter() {
  return (
    <footer className="border-t border-border bg-bg-secondary/95">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs leading-6 text-text-secondary sm:px-6 lg:px-8">
        <div className="font-semibold text-text-primary">사업자정보</div>
        <div>
          상호명 {BUSINESS_INFO.name} | 대표자 {BUSINESS_INFO.representative} | 사업자등록번호{' '}
          {BUSINESS_INFO.registrationNumber}
        </div>
        <div>사업장 주소 {BUSINESS_INFO.address}</div>
        <div>
          업태 {BUSINESS_INFO.businessType} | 종목 {BUSINESS_INFO.businessItems}
        </div>
      </div>
    </footer>
  );
}
