# Requirements

---

## 1. Stakeholders
- Brand Owner/Admin: 브랜드/셀러 운영, 상품/주문/결제/정산 총괄
- Branch Owner/Admin: 스토어/출고지/판매 채널 운영 및 멤버 관리
- Staff: 주문 처리, 재고 확인, 고객 응대
- Viewer: 조회
- Buyer: 공개 온라인샵에서 상품을 주문하는 구매자

---

## 2. Functional Requirements (MVP)

### 2.1 Identity
- 사용자는 인증을 통해 계정 생성/로그인한다.
- 최초 로그인 시 Profile을 생성/수정할 수 있다.

### 2.2 Brand
- Brand를 생성/조회/수정할 수 있다.
- Brand 생성자는 `brand_role=OWNER`, `status=ACTIVE`로 Brand Member가 된다.
- Brand Owner/Admin은 Brand Member를 초대/정지/해제할 수 있다.
- Brand는 공개 온라인샵 주소, 결제 운영 방식, 사업자 정보를 관리한다.

### 2.3 Branch
- Brand Owner/Admin은 Branch를 생성/조회/수정할 수 있다.
- Branch 범위 기능은 Branch Member 기준으로 권한을 판정한다.
- 단, Brand Owner/Admin은 Branch 멤버십이 없어도 Branch 접근이 가능하다(effective role).
- Branch는 제품 언어에서 스토어/출고지/판매 채널로 표현한다.
- Branch는 온라인 주문 링크, 배송/수령 방식, 입금 계좌, 고객 문의 정보를 가진다.

### 2.4 Online Shop & Orders
- 구매자는 브랜드 온라인샵 또는 주문 링크에서 상품을 보고 주문할 수 있다.
- 주문은 결제 방식(PG/무통장), 수령 방식(픽업/배송/택배), 주문 상태를 기록한다.
- 운영자는 주문 목록, 주문 상세, 상태 변경, 결제 상태, 고객 문의 정보를 관리한다.
- 온라인마켓 방향에서는 테이블/좌석 단위 주문을 주요 흐름으로 다루지 않는다.

### 2.5 Membership (Invite & Status)
- 초대 생성 시 status는 `INVITED`
- 수락 시 `ACTIVE`
- 정지 시 `SUSPENDED`
- 해제/탈퇴 시 `LEFT`
- Status Gate로 `ACTIVE`만 권한을 부여한다.

### 2.6 Monetization
- 기본 수익모델은 월 구독료, 결제 운영 수수료, 고급 운영 기능 애드온이다.
- PG 원가는 플랫폼 수익과 분리해서 추적하고, GMV와 순매출을 구분한다.
- Order Friends가 직접 유입을 제공하는 마켓플레이스 수수료는 후속 단계로 검토한다.

---

## 3. Non-Functional Requirements

### 3.1 Security
- Supabase RLS로 테넌트 경계를 최소 안전망으로 강제
- 서버/Edge에서 authorize를 전담하여 권한 판단 SSOT 유지
- 모든 데이터 접근은 tenant filter를 반드시 포함

### 3.2 Performance
- 멤버십 체크가 빈번하므로 권장 인덱스 적용
- 목록 조회는 페이징 기본

### 3.3 Auditability
- 멤버십은 hard delete 하지 않고 상태 전이로 관리
- 핵심 권한 변경(OWNER/ADMIN 등)은 이벤트/로그로 남기는 방향 고려

---

## 4. Out of Scope (MVP)
- 테이블오더 전용 기능
- 공동구매 전용 캠페인 기능
- 외부 배송사/세무/회계 자동화
- 광고형 마켓플레이스 노출 상품
