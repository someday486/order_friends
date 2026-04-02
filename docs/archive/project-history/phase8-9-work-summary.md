# Phase 8-9 작업 내역 정리

## 1. 공개 주문 페이지 - 상품/매장 이미지 표시 수정

### 문제
- 상품 이미지를 업로드했지만 공개 주문 페이지(`/order/[brand]/[branch]`)에서 표시되지 않음
- 브랜드/매장 로고와 커버 이미지가 주문 페이지에 나타나지 않음

### 해결
- **백엔드**: `getProducts()` 응답에 `imageUrl`, `categoryId`, `categoryName` 필드 추가
- **백엔드**: `PublicBranchResponse`에 `logoUrl`, `coverImageUrl` 필드 추가
- **백엔드**: `getBranch()`, `getBranchBySlug()`, `getBranchByBrandSlug()` 3개 메서드 모두에서 branches + brands 테이블의 이미지 URL을 조회하고, 매장 이미지가 없으면 브랜드 이미지로 fallback

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `src/modules/public-order/public-order.service.ts` | 이미지/카테고리 필드 매핑, 브랜치 이미지 조회 |
| `src/modules/public-order/dto/public-order.dto.ts` | `logoUrl`, `coverImageUrl`, `imageUrl`, `categoryId`, `categoryName` 추가 |

---

## 2. 상품 정렬 순서 커스터마이징

### 기능
사업자(OWNER/ADMIN)가 공개 주문 페이지에 표시되는 상품 순서를 직접 설정할 수 있음

### 백엔드
- `products` 테이블에 `sort_order` 컬럼 추가 (마이그레이션 포함)
- 상품 조회 시 `sort_order ASC, created_at ASC` 순으로 정렬
- `sort_order` 컬럼이 아직 DB에 없는 경우 자동으로 `created_at` 정렬로 fallback
- `PATCH /customer/products/reorder` 엔드포인트: 여러 상품의 순서를 한번에 변경

### 프론트엔드 (`/customer/products`)
- "순서 편집" 버튼 (OWNER/ADMIN 권한만 표시)
- 리스트 뷰로 전환하여 위/아래 화살표로 순서 변경
- 저장/취소 기능

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `src/modules/customer-products/customer-products.service.ts` | `reorderProducts()` 메서드, sort_order 지원 |
| `src/modules/customer-products/customer-products.controller.ts` | `PATCH /reorder` 엔드포인트 |
| `src/modules/products/dto/reorder-products.request.ts` | 요청 DTO (신규) |
| `apps/web/src/app/customer/products/page.tsx` | 순서 편집 UI |
| `supabase/migrations/20260208_add_sort_order_to_products.sql` | sort_order 컬럼 마이그레이션 |

---

## 3. 매장별 카테고리 관리 (CRUD)

### 기능
각 매장(branch)별로 독립적인 카테고리 생성/수정/삭제/정렬이 가능

### 백엔드 엔드포인트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/customer/products/categories` | 카테고리 생성 |
| `PATCH` | `/customer/products/categories/:categoryId` | 카테고리 수정 (이름, 활성/비활성) |
| `DELETE` | `/customer/products/categories/:categoryId` | 카테고리 삭제 |
| `PATCH` | `/customer/products/categories/reorder` | 카테고리 순서 변경 |
| `GET` | `/public/branches/:branchId/categories` | 공개 카테고리 목록 (정렬순) |

### 프론트엔드 (`/customer/categories`)
- 매장 선택 드롭다운
- 카테고리 목록: 이름 수정, 활성/비활성 토글, 삭제 (확인 다이얼로그)
- 위/아래 화살표로 순서 변경 (자동 저장)
- 새 카테고리 추가 폼

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `src/modules/customer-products/customer-products.service.ts` | `createCategory()`, `updateCategory()`, `deleteCategory()`, `reorderCategories()` |
| `src/modules/customer-products/customer-products.controller.ts` | 카테고리 CRUD 엔드포인트 4개 |
| `src/modules/products/dto/category-crud.request.ts` | 요청 DTO (신규) |
| `src/modules/public-order/public-order.service.ts` | `getCategories()` 메서드 |
| `src/modules/public-order/public-order.controller.ts` | `GET /public/branches/:id/categories` |
| `src/modules/public-order/dto/public-order.dto.ts` | `PublicCategoryResponse` 클래스 |
| `apps/web/src/app/customer/categories/page.tsx` | 카테고리 관리 페이지 (신규) |
| `apps/web/src/app/customer/layout.tsx` | 사이드바 "카테고리 관리" 메뉴 추가 |

---

## 4. 공개 주문 페이지 개선

### 변경 사항
- 카테고리 탭을 상품에서 추출하던 방식 -> `GET /public/branches/{id}/categories` API 호출로 변경
- 서버에서 설정한 카테고리 순서대로 탭 표시
- 상품도 `sort_order` 기준으로 정렬되어 표시

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `apps/web/src/app/order/[brandSlug]/[branchSlug]/page.tsx` | 카테고리 API 호출, Category 타입에 sortOrder 추가 |

---

## 필요한 DB 작업

> **중요**: 상품 순서 커스터마이징 기능을 완전히 사용하려면 Supabase Dashboard SQL Editor에서 아래 쿼리를 실행해야 합니다.

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
```

컬럼이 추가되기 전에도 기존 기능은 정상 동작합니다 (자동 fallback).

---

## 전체 신규 파일 목록
- `apps/web/src/app/customer/categories/page.tsx` - 카테고리 관리 페이지
- `src/modules/products/dto/reorder-products.request.ts` - 상품 정렬 요청 DTO
- `src/modules/products/dto/category-crud.request.ts` - 카테고리 CRUD 요청 DTO
- `supabase/migrations/20260208_add_sort_order_to_products.sql` - DB 마이그레이션
