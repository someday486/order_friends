# Requirements

---

## 1. Stakeholders
- Brand Owner/Admin: 브랜드/지점/멤버 관리, 운영 총괄
- Branch Owner/Admin: 지점 운영 및 지점 멤버 관리
- Staff: 지점 운영(주문 처리 등)
- Viewer: 조회

---

## 2. Functional Requirements (MVP)

### 2.1 Identity
- 사용자는 인증을 통해 계정 생성/로그인한다.
- 최초 로그인 시 Profile을 생성/수정할 수 있다.

### 2.2 Brand
- Brand를 생성/조회/수정할 수 있다.
- Brand 생성자는 `brand_role=OWNER`, `status=ACTIVE`로 Brand Member가 된다.
- Brand Owner/Admin은 Brand Member를 초대/정지/해제할 수 있다.

### 2.3 Branch
- Brand Owner/Admin은 Branch를 생성/조회/수정할 수 있다.
- Branch 범위 기능은 Branch Member 기준으로 권한을 판정한다.
- 단, Brand Owner/Admin은 Branch 멤버십이 없어도 Branch 접근이 가능하다(effective role).

### 2.4 Membership (Invite & Status)
- 초대 생성 시 status는 `INVITED`
- 수락 시 `ACTIVE`
- 정지 시 `SUSPENDED`
- 해제/탈퇴 시 `LEFT`
- Status Gate로 `ACTIVE`만 권한을 부여한다.

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
- 주문/결제/정산의 실제 업무 기능(단, 스키마 확장 설계는 가능)
- 외부 연동
- 고급 리포팅/통계
