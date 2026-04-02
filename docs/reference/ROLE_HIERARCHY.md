# Role Hierarchy - Quick Reference

## 역할 구분 방법 (데이터베이스 기준)

### 🔴 1. system_admin
```sql
SELECT is_system_admin FROM profiles WHERE id = user_id
-- TRUE이면 system_admin
```
**테이블:** `profiles`
**컬럼:** `is_system_admin` (boolean)
**설명:** Order Friends 회사 관리자 (최고 권한)

---

### 🟠 2. brand_owner
```sql
SELECT * FROM brands WHERE owner_id = user_id
-- 결과가 1개 이상이면 brand_owner
```
**테이블:** `brands`
**컬럼:** `owner_id` (uuid)
**설명:** 브랜드 소유자

---

### 🟡 3. branch_manager
```sql
SELECT * FROM members WHERE user_id = user_id AND role = 'branch_manager'
-- (실제 DB: branch_members.role = 'BRANCH_ADMIN')
```
**VIEW:** `members` (from `branch_members`)
**컬럼:** `role` = `'branch_manager'`
**매핑:** `BRANCH_ADMIN` → `'branch_manager'`
**설명:** 지점 관리자

---

### 🟢 4. staff
```sql
SELECT * FROM members WHERE user_id = user_id AND role = 'staff'
-- (실제 DB: branch_members.role = 'STAFF')
```
**VIEW:** `members` (from `branch_members`)
**컬럼:** `role` = `'staff'`
**매핑:** `STAFF` → `'staff'`
**설명:** 직원

---

### 🔵 5. customer (기본값)
```
위 1~4 어느 것도 해당하지 않으면 자동으로 customer
```
**설명:** 일반 고객

---

## 우선순위 순서 (높음 → 낮음)

```
system_admin > brand_owner > branch_manager > staff > customer
```

하나의 사용자가 여러 역할을 가질 수 있지만, 가장 높은 권한의 역할로 표시됩니다.

---

## 전체 구조 다이어그램

```
┌─────────────────────────────────────────────────┐
│ profiles                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ id (UUID)                                   │ │
│ │ is_system_admin (BOOLEAN) ← system_admin    │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ brands                                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ id (UUID)                                   │ │
│ │ owner_id (UUID) ← brand_owner               │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ members VIEW                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ user_id (UUID)                              │ │
│ │ branch_id (UUID)                            │ │
│ │ role (TEXT) ← 'branch_manager' | 'staff'    │ │
│ │ status (member_status)                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Maps from: branch_members                      │
│ BRANCH_ADMIN → 'branch_manager'                │
│ STAFF → 'staff'                                │
└─────────────────────────────────────────────────┘
```

---

## 역할별 접근 권한

| 역할 | 접근 범위 | 리다이렉트 |
|------|----------|-----------|
| **system_admin** | 모든 브랜드, 모든 지점 | `/admin` |
| **brand_owner** | 소유 브랜드의 모든 지점 | `/admin` |
| **branch_manager** | 할당된 지점 | `/admin` |
| **staff** | 할당된 지점 | `/admin` |
| **customer** | 공개 데이터만 | `/customer` |

---

## 실제 구현 예시

### Backend (/me endpoint)

```typescript
// 1. System Admin 체크
const profile = await db.from('profiles')
  .select('is_system_admin')
  .eq('id', userId)
  .single();

if (profile.is_system_admin) {
  return { role: 'system_admin' };
}

// 2. Brand Owner 체크
const brands = await db.from('brands')
  .select('id')
  .eq('owner_id', userId);

if (brands.length > 0) {
  return { role: 'brand_owner' };
}

// 3. Branch Manager / Staff 체크
const memberships = await db.from('members')  // VIEW
  .select('role')
  .eq('user_id', userId);

const roles = memberships.map(m => m.role);
if (roles.includes('branch_manager')) {
  return { role: 'branch_manager' };
}
if (roles.includes('staff')) {
  return { role: 'staff' };
}

// 4. Default
return { role: 'customer' };
```

### Frontend (Redirect)

```typescript
switch (role) {
  case 'system_admin':
  case 'brand_owner':
  case 'branch_manager':
  case 'staff':
    router.push('/admin');
    break;
  case 'customer':
  default:
    router.push('/customer');
    break;
}
```

---

## 역할 부여 방법

### System Admin 추가
```sql
UPDATE profiles
SET is_system_admin = TRUE
WHERE id = 'user-uuid';
```

### Brand Owner 추가
```sql
UPDATE brands
SET owner_id = 'user-uuid'
WHERE id = 'brand-uuid';
```

### Branch Manager 추가
```sql
INSERT INTO branch_members (branch_id, user_id, role, status)
VALUES ('branch-uuid', 'user-uuid', 'BRANCH_ADMIN', 'ACTIVE');
```

### Staff 추가
```sql
INSERT INTO branch_members (branch_id, user_id, role, status)
VALUES ('branch-uuid', 'user-uuid', 'STAFF', 'ACTIVE');
```

---

## 관련 문서

- [System Admin Setup Guide](../guides/SYSTEM_ADMIN_SETUP.md)
- [Members VIEW Documentation](./DATABASE_MEMBERS_VIEW.md)
- [Database Schema](../supabase/migration/20260114_0000_core_tables.sql)

---

**Last Updated:** 2026-02-06
