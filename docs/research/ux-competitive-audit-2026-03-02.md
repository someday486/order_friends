# Order Friends 경쟁 UX/디자인 점검 리포트 (2026-03-02)

## 1. 점검 목적
- 현재 앱의 사용자 경험(고객 주문/운영자 주문 처리/관리 UI)을 점검한다.
- 유사 서비스(국내 사장님 앱 + 글로벌 머천트 운영 도구)와 비교해 기능적/경험적 격차를 도출한다.
- 바로 실행 가능한 개선 우선순위(0~12주)를 제안한다.

## 2. 점검 범위
- 고객 주문 플로우: `/order/*`, `/shop/*`, `/order/track/*`
- 운영자 플로우: `/customer/orders`, `/customer/products`, `/customer/analytics`, `/customer/*`
- 공통 UX 컴포넌트: `Modal`, 알림/토스트, 테이블/배지, 모바일 레이아웃

## 3. 현재 제품 진단 (코드 근거)

### 강점
1. 운영 주문 화면의 제어 기능이 풍부함
- 상태 필터, 이행방식 필터, 일괄 상태변경, 내보내기 기능이 존재.
- 근거: `apps/web/src/app/customer/orders/page.tsx`

2. 고객 주문 경험의 재주문/자동입력 편의가 좋음
- 재주문 배너, 체크아웃 초안 저장, 로그인 사용자 정보/지난 주문 정보 자동 채움.
- 근거: `apps/web/src/app/order/[brandSlug]/[branchSlug]/OrderPageClient.tsx`, `apps/web/src/app/order/[brandSlug]/[branchSlug]/checkout/page.tsx`

3. 주문 추적 페이지의 피드백 밀도
- 10초 폴링, 상태 힌트 텍스트, READY 전환 사운드 등 상태 인지 장치 제공.
- 근거: `apps/web/src/app/order/track/[orderId]/page.tsx:53`, `:216`, `:251`, `:341`

### 약점
1. 실시간 운영성이 폴링 중심
- 주문 목록 자동갱신은 10초 폴링 기반.
- 알림 센터는 60초 폴링 기반.
- 근거: `apps/web/src/app/customer/orders/page.tsx:110`, `:503`; `apps/web/src/providers/NotificationProvider.tsx:70`, `:192`

2. 실시간 채널(WebSocket/SSE/Realtime) 부재
- 프런트 코드 기준 실시간 채널 구현 흔적 없음.
- 근거: `apps/web/src` 전역 검색 결과 `NO_REALTIME_CHANNEL_CODE`

3. 운영 액션의 일부가 아직 미완
- 선택 주문 내보내기 관련 안내 문구가 “다음 업데이트에서 지원 예정”.
- 근거: `apps/web/src/app/customer/orders/page.tsx:290`

4. 분석 화면의 액션 연결성 약함
- 분석 페이지는 조회 중심이며 운영 변경 API 호출/딥링크 액션이 제한적.
- 근거: `apps/web/src/app/customer/analytics/page.tsx` (`router.push("/")` 외 운영 액션 호출 부재), `apps/web/src/app/customer/analytics/brand/page.tsx` (`READ_ONLY_ANALYTICS_BRAND`)

5. 디자인 시스템의 브랜드 개성은 약함
- 장점: 토큰화(CSS 변수), 일관된 색 체계, 다크모드 지원.
- 한계: 기본 시스템 폰트 스택 중심으로 시각적 차별성은 제한.
- 근거: `apps/web/src/app/globals.css`, `apps/web/tailwind.config.js`

## 4. 경쟁 앱 벤치마크 (2026-03-02 기준)

### DoorDash Merchant
- 2025-11-01 공개된 Live Order Management에서 모바일 앱으로 실시간 주문 관리, 준비시간 조정, 환불/대체/품절 처리, 고객/배달원 커뮤니케이션 제공.
- Merchant Portal은 채널별 주문을 실시간으로 추적하고 운영/마케팅/리포팅까지 연결.

### Toast
- 온라인 주문에서 POS 연동 기반 실시간 메뉴/주문 동기화, 로열티/푸시 알림, Google 주문 유입 연동을 강조.
- 서드파티 배달 통합으로 다채널 주문을 단일 운영 흐름에 통합.

### Square
- 온라인/오프라인 주문 통합, 주방 전달 자동화, 다지점 주문 처리, 알림/출력 설정 등 운영 자동화 기능 제공.
- 온디맨드 배송의 실시간 배송 추적(고객/매장)도 지원.

### 국내 레퍼런스 (배민/요기요)
- 배민사장님 앱은 최신 버전 4.35.0이 2026-02-26 기준으로 배포되어 운영 앱이 지속 업데이트 중.
- 요기요 사장님 서비스 공지에는 주문접수 알림, 영업시간 변경, 메뉴 품절 관리, 매장 준비시간 관리 등 운영자 핵심 플로우 중심 업데이트가 반복됨.

## 5. 격차 요약 (우리 앱 vs 경쟁군)

1. 주문 처리 속도
- 우리 앱: 폴링 기반(10초/60초), 수동 개입 비중 존재
- 경쟁군: 실시간 알림 + 모바일에서 즉시 예외처리

2. 예외 처리 완결성
- 우리 앱: 주문 상태 변경은 가능하나 환불/대체/부분취소의 현장형 워크플로우는 약함
- 경쟁군: 주문 이슈 처리(대체/품절/환불/고객 커뮤니케이션) 내장

3. 분석→실행 루프
- 우리 앱: 분석 데이터는 풍부하나 운영 액션 연결이 약함
- 경쟁군: 지표를 바로 마케팅/재고/메뉴 운영으로 전환하는 동선 강함

4. 운영자 모바일 최적화
- 우리 앱: 테이블/필터 기반 화면이 강하고 데스크톱 친화적
- 경쟁군: 이동 중 1~2탭 처리 중심의 모바일 운영 플로우 제공

## 6. 우선순위 제안

### P0 (0~2주)
1. 운영 실시간성 강화
- 주문 목록 상단에 “신규/지연/미처리” 큐 시각화 배지 추가
- 폴링 주기 동적화: 혼잡 시간 단축, 유휴 시간 완화
- 알림 이벤트 우선순위 정렬 개선

2. 주문 상세 즉시 액션 보강
- 품절/대체/부분취소/취소사유 입력을 주문 상세에서 즉시 처리하는 패널 도입

### P1 (3~6주)
1. 분석 화면 액션화
- 주요 차트 카드에 “바로 실행” 버튼 연결
- 예: 품절 빈도 높은 상품 -> 재고/메뉴 노출 전환, 지연 높은 시간대 -> 준비시간 정책 조정

2. 모바일 운영 모드
- 주문 상세 하단 고정 액션 바(접수/준비/완료/예외)
- 큰 터치 타겟 + 스와이프 보조로 1손 조작 최적화

### P2 (7~12주)
1. 채널 통합 운영 보드
- 지점/온라인샵/채널별 SLA, 취소율, 지연, 품절을 한 화면에 통합

2. 운영 자동화
- 규칙 기반 자동 처리(예: 특정 조건에서 준비시간 자동 확장, 품절 자동 전환)

## 7. KPI 제안
- 주문 최초응답 시간(평균/95p): 20% 이상 단축
- 주문 이슈 처리 리드타임(부분취소/대체/환불): 30% 이상 단축
- 운영자 모바일 세션당 처리 건수: 15% 이상 증가
- CS 문의 중 “주문 상태/처리 혼선” 비중: 20% 이상 감소

## 8. 참고 자료 (확인일: 2026-03-02)
- DoorDash Live Order Management (2025-11-01): https://merchants.doordash.com/learning-center/live-order-management
- DoorDash Merchant Portal: https://merchants.doordash.com/en-us./products/merchant-portal
- Toast Online Ordering: https://pos.toasttab.com/products/online-ordering/
- Toast Third-party Delivery Integrations: https://pos.toasttab.com/third-party-delivery-integrations/
- Square Online Ordering: https://squareup.com/us/en/online-ordering
- Square Order Manager: https://squareup.com/help/us/en/article/8322-set-up-order-manager
- 배민사장님 App Store: https://apps.apple.com/kr/app/%EB%B0%B0%EB%AF%BC%EC%82%AC%EC%9E%A5%EB%8B%98/id1042003297
- 요기요 사장님앱 공지: https://owners.yogiyo.co.kr/notice/2025-update
