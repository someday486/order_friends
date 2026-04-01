# User Flows

---

## Flow A. Onboarding (Auth → Profile)
1) 사용자 로그인/가입
2) Profile 생성(표시명/전화번호)
3) 이후 모든 권한 판정은 profile(user_id) 기반으로 수행

---

## Flow B. Brand 생성
1) 인증된 사용자만 Brand 생성 가능
2) Brand 생성 시:
   - brands row 생성
   - brand_members row 생성:
     - role=OWNER
     - status=ACTIVE
3) ACTIVE OWNER는 brand별 1명 유지(정책)

---

## Flow C. Branch 생성
1) Brand OWNER/ADMIN authorize
2) branches row 생성(brand_id 포함)
3) (정책) 생성자를 branch member로 자동 추가 여부
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
