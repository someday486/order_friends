# Codex 업무지시서: UI 수정 작업

## 프로젝트 정보
- 프론트엔드: `apps/web/` (Next.js 16, TypeScript, Tailwind CSS)
- 컴포넌트: `apps/web/src/components/ui/`
- 페이지: `apps/web/src/app/customer/`

---

## Task 1: 알림벨 위치 변경 (우측 상단)

**파일**: `apps/web/src/app/customer/layout.tsx`

**현재 상태**: NotificationBell이 사이드바 로고 영역(좌측)에 위치함

**요구사항**:
- 데스크톱: 사이드바에서 NotificationBell 제거. `<main>` 영역 상단 우측에 알림벨을 배치 (고정 헤더 바 형태)
- 모바일: 현재 위치(상단 헤더 우측) 유지 — 이미 올바른 위치
- 데스크톱 헤더 바: `<main>` 내부 최상단에 `flex justify-end` 바를 추가하고, 그 안에 NotificationBell + 다크모드 토글 배치
- 사이드바 하단의 다크모드 버튼은 데스크톱에서 이 상단 바로 이동

---

## Task 2: 사이드바 스크롤 고정

**파일**: `apps/web/src/app/customer/layout.tsx`

**현재 상태**: `<aside>`에 `fixed md:sticky top-0`이 이미 적용되어 있음

**요구사항**:
- 데스크톱에서 페이지 스크롤 시 사이드바가 화면에 고정되어 있어야 함
- `aside`에 `md:h-screen md:overflow-y-auto` 확인하고, `md:sticky top-0`이 제대로 동작하는지 확인
- 부모 컨테이너가 `md:grid md:grid-cols-[240px_1fr]`이므로 sticky가 동작하려면 aside의 높이가 `h-screen`이어야 함
- 현재 `h-screen`이 있으므로 sticky가 동작해야 하지만, 만약 안 되면 `md:fixed`로 변경하고 main에 `md:ml-[240px]` 추가

---

## Task 3: 카테고리 활성화/비활성화 아이콘 변경

**파일**: `apps/web/src/app/customer/categories/page.tsx`

**현재 상태**: 활성/비활성 토글 버튼이 🔒/🔓 자물쇠 이모지 사용 중 (line ~350)

**요구사항**:
- 🔒/🔓 대신 토글 스위치 UI로 변경
- 활성 상태: 초록색 배경의 토글 (오른쪽에 원)
- 비활성 상태: 회색 배경의 토글 (왼쪽에 원)
- 순수 CSS/Tailwind로 구현 (라이브러리 불필요)
- 클릭 시 기존 `handleToggleActive` 함수 호출 유지
- 크기: 높이 20px, 너비 36px 정도의 작은 토글

---

## Task 4: 카테고리 일괄 활성화 API 연동 개선

**파일**: `apps/web/src/app/customer/categories/page.tsx`

**현재 상태**: `handleBulkToggle` 함수가 개별 PATCH를 병렬로 보냄

**요구사항**:
- 개별 PATCH 대신 새 벌크 API 사용: `PATCH /customer/products/categories/bulk-status`
- Request body: `{ branchId: string, categoryIds: string[], isActive: boolean }`
- 한번의 API 호출로 일괄 처리
- 성공 시 카테고리 목록 새로고침

---

## 빌드 검증
모든 작업 완료 후 `cd apps/web && npx next build` 실행하여 빌드 통과 확인할 것.
