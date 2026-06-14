# User Flows

---

## Flow A. Onboarding (Auth → Profile)
1) 사용자 로그인/가입
2) 이메일 인증과 Profile 생성(표시명/전화번호)
3) 시스템 관리자가 계정을 다음 중 하나로 연결한다.
   - 브랜드 생성 가능 계정(`canCreateBrand`)
   - 기존 Brand/Branch 멤버
4) 브랜드 생성 가능 계정은 첫 로그인 후 Brand 생성 화면으로 이동한다.
5) 기존 멤버 계정은 권한에 맞는 운영 화면으로 이동한다.
6) 승인 또는 멤버 연결 전에는 승인 대기 화면에서 상태를 다시 확인한다.
7) 이후 모든 권한 판정은 profile(user_id) 기반으로 수행
8) 운영 화면 진입 후 대시보드의 시작 체크리스트에서 브랜드/셀러, 스토어/출고지,
   상품, 주문 링크 준비 상태를 확인한다.

---

## Flow B. Brand 생성
1) 인증되고 브랜드 생성 가능 승인을 받았거나 기존 Brand OWNER/ADMIN인 사용자만 Brand 생성 가능
2) Brand 생성 시:
   - brands row 생성
   - brand_members row 생성:
     - role=OWNER
     - status=ACTIVE
3) Brand 생성 시 결제 운영 방식(PG / Non-PG)을 결정한다.
4) ACTIVE OWNER는 brand별 1명 유지(정책)

---

## Flow C. Branch 생성
1) Brand OWNER/ADMIN authorize
2) 스토어/출고지/판매 채널 정보를 입력한다.
3) branches row 생성(brand_id 포함)
4) (정책) 생성자를 branch member로 자동 추가 여부
   - 권장: 자동 추가하지 않아도 됨
   - 이유: Brand OWNER/ADMIN은 effective role로 branch 접근 가능

---

## Flow D. Member Invite (Brand)
1) Brand OWNER/ADMIN이 초대 생성
2) brand_members status=INVITED 생성(또는 invite 테이블 별도 운영)
3) 대상 수락 시 status=ACTIVE
4) 거절/만료 시 status=LEFT 처리

---

## Flow E. Member Invite (Branch)
1) Branch OWNER/ADMIN이 초대 생성
2) branch_members status=INVITED 생성
3) 수락 시 ACTIVE, 정지/해제는 status 전이로 처리

---

## Flow F. Suspension / Reinstate
- 정지: ACTIVE → SUSPENDED
- 복구: SUSPENDED → ACTIVE
- 모든 요청은 status gate로 차단/허용

---

## Flow G. Online Shop Setup
1) Brand OWNER/ADMIN이 브랜드 URL(slug), 로고, 상품 노출 정책을 설정한다.
2) 시스템은 `/shop/:brandSlug` 공개 온라인샵 주소를 생성한다.
3) PG 브랜드는 카드 결제 주문 흐름을 사용한다.
4) Non-PG 브랜드는 카드 등록으로 14일 무료 체험과 구독 상태를 만든 뒤 공개 온라인샵 접근이 가능하다.
5) Brand 하위 Branch는 주문 처리 스토어/출고지로 연결된다.
6) 온라인샵은 브랜드 단위 상품 목록과 주문 진입점을 제공한다.

---

## Flow H. Buyer Order
1) 구매자가 온라인샵 또는 주문 링크로 진입한다.
2) 상품과 옵션, 배송/수령 방식을 선택한다. 테이블/좌석 주문 표현은 사용하지 않는다.
3) PG 브랜드는 카드 결제 흐름으로, Non-PG 브랜드는 입금 안내 흐름으로 주문한다.
4) 현금영수증은 구매자 화면에서 요청 정보를 접수하고, 자동 발행 설정은 운영자
   브랜드 설정에서 별도로 관리한다.
5) 주문 생성 후 구매자는 주문 추적 페이지에서 상태와 결제/배송 안내를 확인한다.
6) 운영자는 고객 주문을 접수, 확인, 배송/수령 처리, 취소/환불한다.

---

## Flow I. Seller Operations
1) 운영자가 주문 목록에서 신규 주문, 결제 상태, 수령/배송 방식을 확인한다.
2) 필요 시 상품 재고와 주문 상태를 업데이트한다.
3) 판매 분석과 정산 화면에서 GMV, 결제 원가, 플랫폼 수익, 정산 예정액을 확인한다.
4) 주문자가 보는 결제 방식은 주문 결제 화면에서, 셀러 이용료/구독과 PG 정산은
   별도 운영 화면에서 관리한다.
5) 대량 발주, 공급처, 입고 중심 B2B 화면은 현재 주력 운영 동선에서 노출하지 않는다.
