'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { useSelectedBrand } from '@/hooks/useSelectedBrand';
import { useSelectedBranch } from '@/hooks/useSelectedBranch';
import BranchSelector from '@/components/admin/BranchSelector';
import Link from 'next/link';

// ============================================================
// Types
// ============================================================

type BrandRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';
type BranchRole = 'BRANCH_OWNER' | 'BRANCH_ADMIN' | 'STAFF' | 'VIEWER';
type MemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';

type BrandMember = {
  id: string;
  brandId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: BrandRole;
  status: MemberStatus;
  createdAt: string;
};

type BranchMember = {
  id: string;
  branchId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: BranchRole;
  status: MemberStatus;
  createdAt: string;
};

type PendingApprovalUser = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  createdAt: string;
  emailConfirmedAt?: string | null;
  isEmailConfirmed: boolean;
};

type MemberProfileResponse = {
  id: string;
  displayName?: string | null;
};

type BrandInfo = {
  id: string;
  name: string;
};

type BranchInfo = {
  id: string;
  name: string;
};

// ============================================================
// Constants
// ============================================================

const BRAND_ROLES: { value: BrandRole; label: string }[] = [
  { value: 'OWNER', label: '오너' },
  { value: 'ADMIN', label: '관리자' },
  { value: 'MANAGER', label: '매니저' },
  { value: 'MEMBER', label: '멤버' },
];

const BRANCH_ROLES: { value: BranchRole; label: string }[] = [
  { value: 'BRANCH_OWNER', label: '점장' },
  { value: 'BRANCH_ADMIN', label: '부점장' },
  { value: 'STAFF', label: '스태프' },
  { value: 'VIEWER', label: '뷰어' },
];

const STATUS_LABELS: Record<MemberStatus, string> = {
  INVITED: '초대중',
  ACTIVE: '활성',
  SUSPENDED: '정지',
  LEFT: '탈퇴',
};

// ============================================================
// Helpers
// ============================================================

function formatPendingDate(value: string) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

// ============================================================
// Component
// ============================================================

function MembersPageContent() {
  const searchParams = useSearchParams();
  const initialTab = useMemo(
    () => searchParams?.get('tab') ?? '',
    [searchParams],
  );
  const initialBranchId = useMemo(
    () => searchParams?.get('branchId') ?? '',
    [searchParams],
  );

  const { brandId, ready: brandReady, selectBrand } = useSelectedBrand();
  const { branchId, selectBranch, clearBranch } = useSelectedBranch();
  const [tab, setTab] = useState<'brand' | 'branch'>('brand');
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab === 'branch' || initialTab === 'brand') {
      setTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialBranchId) selectBranch(initialBranchId);
  }, [initialBranchId, selectBranch]);

  // Brand members
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandMembersLoaded, setBrandMembersLoaded] = useState(false);

  // Branch members
  const [branchMembers, setBranchMembers] = useState<BranchMember[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // Add member form
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<PendingApprovalUser[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandInfo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchInfo | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState('');
  const [savingProfileUserId, setSavingProfileUserId] = useState<string | null>(
    null,
  );

  const fetchPendingUsers = async () => {
    try {
      setPendingLoading(true);
      setPendingError(null);
      const data = await apiClient.get<PendingApprovalUser[]>(
        '/admin/members/pending',
      );
      setPendingUsers(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setPendingError(
        (e as Error)?.message ?? '승인 대기 계정 조회에 실패했습니다.',
      );
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    void fetchPendingUsers();
  }, []);

  const fetchBrands = async () => {
    try {
      setBrandsLoading(true);
      setBrandsError(null);
      const data = await apiClient.get<BrandInfo[]>('/admin/brands');
      setBrands(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setBrandsError((e as Error)?.message ?? '브랜드 목록 조회에 실패했습니다.');
    } finally {
      setBrandsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBrands();
  }, []);

  useEffect(() => {
    if (!brandId) {
      setSelectedBrand(null);
      return;
    }

    let cancelled = false;

    const fetchSelectedBrand = async () => {
      try {
        const data = await apiClient.get<BrandInfo>('/admin/brands/' + brandId);
        if (!cancelled) {
          setSelectedBrand({ id: data.id, name: data.name });
        }
      } catch {
        if (!cancelled) {
          setSelectedBrand(null);
        }
      }
    };

    void fetchSelectedBrand();

    return () => {
      cancelled = true;
    };
  }, [brandId]);

  useEffect(() => {
    if (!branchId) {
      setSelectedBranch(null);
      return;
    }

    let cancelled = false;

    const fetchSelectedBranch = async () => {
      try {
        const data = await apiClient.get<BranchInfo>(
          '/admin/branches/' + branchId,
        );
        if (!cancelled) {
          setSelectedBranch({ id: data.id, name: data.name });
        }
      } catch {
        if (!cancelled) {
          setSelectedBranch(null);
        }
      }
    };

    void fetchSelectedBranch();

    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const selectPendingUser = (userId: string) => {
    setNewUserId(userId);
  };

  const startEditingUser = (
    userId: string,
    displayName?: string | null,
  ) => {
    setEditingUserId(userId);
    setEditingDisplayName(displayName ?? '');
  };

  const cancelEditingUser = () => {
    setEditingUserId(null);
    setEditingDisplayName('');
  };

  const applyDisplayName = (userId: string, displayName: string | null) => {
    setPendingUsers((prev) =>
      prev.map((user) =>
        user.id === userId ? { ...user, displayName } : user,
      ),
    );
    setBrandMembers((prev) =>
      prev.map((member) =>
        member.userId === userId ? { ...member, displayName } : member,
      ),
    );
    setBranchMembers((prev) =>
      prev.map((member) =>
        member.userId === userId ? { ...member, displayName } : member,
      ),
    );
  };

  const saveUserProfile = async (userId: string) => {
    try {
      setSavingProfileUserId(userId);
      const data = await apiClient.patch<MemberProfileResponse>(
        '/admin/members/profile/' + userId,
        {
          displayName: editingDisplayName,
        },
      );
      applyDisplayName(userId, data.displayName ?? null);
      cancelEditingUser();
      toast.success('사용자 정보를 수정했습니다.');
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? '사용자 정보 수정에 실패했습니다.');
    } finally {
      setSavingProfileUserId(null);
    }
  };

  const handleBrandChange = (nextBrandId: string) => {
    if (!nextBrandId || nextBrandId === brandId) return;
    selectBrand(nextBrandId);
    setBrandMembers([]);
    setBrandMembersLoaded(false);
    setBrandError(null);
    clearBranch();
    setSelectedBranch(null);
    setBranchMembers([]);
    setBranchError(null);
  };

  const activeBrandOwner = useMemo(
    () =>
      brandMembers.find(
        (member) => member.role === 'OWNER' && member.status === 'ACTIVE',
      ) ?? null,
    [brandMembers],
  );

  const isOwnerOptionDisabled = (targetUserId?: string) =>
    Boolean(
      activeBrandOwner &&
        (!targetUserId || activeBrandOwner.userId !== targetUserId),
    );

  // ============================================================
  // Brand Members
  // ============================================================

  const fetchBrandMembers = async () => {
    if (!brandId) return;

    try {
      setBrandLoading(true);
      setBrandError(null);

      const data = await apiClient.get<BrandMember[]>(
        '/admin/members/brand/' + brandId,
      );
      setBrandMembers(data);
      setBrandMembersLoaded(true);
    } catch (e: unknown) {
      setBrandMembersLoaded(false);
      setBrandError(
        (e as Error)?.message ?? '브랜드 멤버 조회에 실패했습니다.',
      );
    } finally {
      setBrandLoading(false);
    }
  };

  const addBrandMember = async () => {
    if (!brandId || !newUserId) return;

    try {
      setAdding(true);

      await apiClient.post('/admin/members/brand/' + brandId, {
        userId: newUserId,
        role: newRole || 'MEMBER',
      });

      await fetchBrandMembers();
      await fetchPendingUsers();
      setNewUserId('');
      setNewRole('');
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? '멤버 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const updateBrandMemberRole = async (userId: string, role: BrandRole) => {
    try {
      await apiClient.patch('/admin/members/brand/' + brandId + '/' + userId, {
        role,
      });

      setBrandMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m)),
      );
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? '권한 변경에 실패했습니다.');
    }
  };

  const removeBrandMember = async (userId: string) => {
    if (!confirm('해당 멤버를 삭제하시겠습니까?')) return;

    try {
      await apiClient.delete('/admin/members/brand/' + brandId + '/' + userId);
      setBrandMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? '멤버 삭제에 실패했습니다.');
    }
  };

  // ============================================================
  // Branch Members
  // ============================================================
  // Branch Members
  // ============================================================

  const fetchBranchMembers = async () => {
    if (!branchId) return;

    try {
      setBranchLoading(true);
      setBranchError(null);

      const data = await apiClient.get<BranchMember[]>(
        '/admin/members/branch/' + branchId,
      );
      setBranchMembers(data);
    } catch (e: unknown) {
      setBranchError((e as Error)?.message ?? '매장 멤버 조회에 실패했습니다.');
    } finally {
      setBranchLoading(false);
    }
  };

  const addBranchMember = async () => {
    if (!branchId || !newUserId) return;

    try {
      setAdding(true);

      await apiClient.post('/admin/members/branch', {
        branchId,
        userId: newUserId,
        role: newRole || 'STAFF',
      });

      await fetchBranchMembers();
      await fetchPendingUsers();
      setNewUserId('');
      setNewRole('');
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? '멤버 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const updateBranchMemberRole = async (userId: string, role: BranchRole) => {
    try {
      await apiClient.patch(
        '/admin/members/branch/' + branchId + '/' + userId,
        { role },
      );

      setBranchMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m)),
      );
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? '권한 변경에 실패했습니다.');
    }
  };

  const removeBranchMember = async (userId: string) => {
    if (!confirm('해당 멤버를 삭제하시겠습니까?')) return;

    try {
      await apiClient.delete(
        '/admin/members/branch/' + branchId + '/' + userId,
      );
      setBranchMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? '멤버 삭제에 실패했습니다.');
    }
  };

  // ============================================================
  // Render
  // ============================================================
  // Render
  // ============================================================

  return (
    <div>
      <h1 className="text-[22px] font-extrabold mb-2 text-foreground">
        권한 관리
      </h1>
      <p className="text-text-secondary mb-6 text-[13px]">
        시스템 관리자가 가입한 사용자를 브랜드 및 가게 멤버로 승인하는
        화면입니다.
      </p>

      <div className="card p-4 mb-6">
        <div className="font-semibold text-foreground">관리 대상 브랜드</div>
        <div className="text-xs text-text-secondary mt-1">
          권한 관리 페이지 안에서 바로 브랜드를 바꿀 수 있습니다. 브랜드를
          바꾸면 가게 선택은 초기화됩니다.
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={brandId ?? ''}
            onChange={(e) => handleBrandChange(e.target.value)}
            disabled={brandsLoading || brands.length === 0}
            className="h-10 min-w-[260px] rounded-lg border border-border bg-bg-secondary px-3 text-sm text-foreground"
          >
            <option value="">브랜드를 선택하세요</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
          {brandId ? (
            <div className="text-xs text-text-secondary font-mono break-all">
              현재 선택: {brandId}
            </div>
          ) : null}
        </div>
        {brandsLoading ? (
          <div className="mt-2 text-xs text-text-tertiary">
            브랜드 목록을 불러오는 중...
          </div>
        ) : null}
        {brandsError ? (
          <div className="mt-2 text-xs text-danger-500">{brandsError}</div>
        ) : null}
      </div>

      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-semibold text-foreground">승인 대기 계정</div>
            <div className="text-xs text-text-secondary mt-1">
              아직 브랜드나 가게 멤버십이 없는 가입 계정입니다. 버튼을 누르면
              아래 입력칸에 UUID가 채워집니다.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchPendingUsers()}
            disabled={pendingLoading}
            className="h-9 px-4 rounded-lg border border-border bg-transparent text-[13px] text-foreground hover:bg-bg-tertiary transition-colors disabled:opacity-50"
          >
            {pendingLoading ? '새로고침 중...' : '새로고침'}
          </button>
        </div>

        {pendingError ? (
          <p className="text-danger-500 text-sm">{pendingError}</p>
        ) : pendingUsers.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            승인 대기 중인 계정이 없습니다.
          </p>
        ) : (
          <div className="grid gap-3">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-border bg-bg-secondary p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {user.email ?? '이메일 정보 없음'}
                    </div>
                    {editingUserId === user.id ? (
                      <input
                        type="text"
                        value={editingDisplayName}
                        onChange={(e) => setEditingDisplayName(e.target.value)}
                        placeholder="이름"
                        className="mt-2 h-9 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-foreground"
                      />
                    ) : null}
                    <div
                      className={
                        editingUserId === user.id
                          ? 'hidden'
                          : 'text-xs text-text-secondary mt-1'
                      }
                    >
                      {user.displayName ?? '이름 없음'} · 가입일{' '}
                      {formatPendingDate(user.createdAt)}
                    </div>
                    {editingUserId === user.id ? (
                      <div className="text-xs text-text-secondary mt-1">
                        媛?낆씪 {formatPendingDate(user.createdAt)}
                      </div>
                    ) : null}
                    <div className="text-[11px] text-text-tertiary font-mono mt-1 break-all">
                      {user.id}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap md:justify-end">
                    <span
                      className={`inline-flex h-[24px] items-center rounded-full px-2.5 text-[11px] font-semibold ${
                        user.isEmailConfirmed
                          ? 'bg-success/20 text-success'
                          : 'bg-warning/20 text-warning'
                      }`}
                    >
                      {user.isEmailConfirmed
                        ? '이메일 확인 완료'
                        : '이메일 확인 전'}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectPendingUser(user.id)}
                      className="h-9 px-4 rounded-lg bg-primary-500 text-white text-[13px] font-semibold hover:bg-primary-600 transition-colors"
                    >
                      UUID 채우기
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('brand')}
          className={`py-2 px-4 rounded-lg border font-semibold cursor-pointer text-[13px] transition-colors ${
            tab === 'brand'
              ? 'bg-bg-tertiary border-border text-foreground'
              : 'bg-transparent border-border text-text-secondary hover:bg-bg-tertiary'
          }`}
        >
          브랜드 멤버
        </button>
        <button
          onClick={() => setTab('branch')}
          className={`py-2 px-4 rounded-lg border font-semibold cursor-pointer text-[13px] transition-colors ${
            tab === 'branch'
              ? 'bg-bg-tertiary border-border text-foreground'
              : 'bg-transparent border-border text-text-secondary hover:bg-bg-tertiary'
          }`}
        >
          가게 멤버
        </button>
      </div>

      {/* Brand Members Tab */}
      {tab === 'brand' && (
        <div>
          {!brandReady || !brandId ? (
            <div className="card p-2.5 flex items-center gap-3 mb-4">
              <div className="text-xs text-text-secondary">
                브랜드가 선택되어 있지 않습니다.
              </div>
              <Link href="/admin/brand" className="text-foreground text-[13px]">
                브랜드 선택하러 가기
              </Link>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={fetchBrandMembers}
                  disabled={!brandId || brandLoading}
                  className="btn-primary h-9 px-4 text-[13px]"
                >
                  {brandLoading ? '로딩...' : '조회'}
                </button>
              </div>

              {/* 멤버 추가 */}
              <div className="card p-4 mb-4">
                <div className="mb-3 rounded-lg border border-primary-500/20 bg-primary-500/10 p-3">
                  <div className="text-[11px] font-semibold text-primary-500">
                    현재 권한 부여 대상 브랜드
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {selectedBrand?.name ?? '선택된 브랜드 확인 중'}
                  </div>
                  <div className="mt-1 text-[11px] text-text-secondary font-mono break-all">
                    {brandId}
                  </div>
                </div>
                <div className="font-semibold mb-3 text-foreground">
                  멤버 추가
                </div>
                <div className="mb-3 text-xs text-text-secondary">
                  아래에서 추가하면 선택된 브랜드에 바로 권한이 부여됩니다.
                </div>
                <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-text-secondary">
                  <div className="font-semibold text-warning">
                    브랜드당 활성 오너는 1명만 지정할 수 있습니다.
                  </div>
                  <div className="mt-1">
                    {!brandMembersLoaded
                      ? '오너 정보 확인을 위해 먼저 조회를 눌러주세요.'
                      : activeBrandOwner
                        ? `현재 오너: ${activeBrandOwner.displayName || activeBrandOwner.userId}`
                        : '현재는 지정된 활성 오너가 없습니다.'}
                  </div>
                  <div className="mt-1">
                    오너를 변경하려면 기존 오너를 먼저 ADMIN, MANAGER 또는 MEMBER로 변경하세요.
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="User UUID"
                    className="input-field w-[280px]"
                  />
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-border bg-bg-secondary text-foreground text-[13px]"
                  >
                    <option value="">역할 선택</option>
                    {BRAND_ROLES.map((r) => (
                      <option
                        key={r.value}
                        value={r.value}
                        disabled={
                          r.value === 'OWNER' &&
                          (!brandMembersLoaded || isOwnerOptionDisabled())
                        }
                      >
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addBrandMember}
                    disabled={adding || !newUserId}
                    className="btn-primary h-9 px-4 text-[13px]"
                  >
                    {adding ? '추가 중...' : '추가'}
                  </button>
                </div>
              </div>

              {/* 에러 */}
              {brandError && (
                <p className="text-danger-500 mb-4">{brandError}</p>
              )}

              {/* 멤버 목록 */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full border-collapse">
                  <thead className="bg-bg-tertiary">
                    <tr>
                      <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                        사용자
                      </th>
                      <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                        역할
                      </th>
                      <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                        상태
                      </th>
                      <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandMembers.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-3 px-3.5 text-[13px] text-center text-text-tertiary"
                        >
                          멤버가 없습니다.
                        </td>
                      </tr>
                    )}
                    {brandMembers.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-3 px-3.5 text-[13px] text-foreground">
                          {editingUserId === m.userId ? (
                            <input
                              type="text"
                              value={editingDisplayName}
                              onChange={(e) =>
                                setEditingDisplayName(e.target.value)
                              }
                              placeholder="이름"
                              className="h-8 w-full rounded-md border border-border bg-bg-secondary px-2 text-xs text-foreground"
                            />
                          ) : (
                            <div>{m.displayName || '-'}</div>
                          )}
                          {m.email ? (
                            <div className="text-[11px] text-text-secondary">
                              {m.email}
                            </div>
                          ) : null}
                          <div className="text-[11px] text-text-tertiary font-mono">
                            {m.userId.slice(0, 8)}...
                          </div>
                          <div className="mt-2 flex gap-2">
                            {editingUserId === m.userId ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void saveUserProfile(m.userId)}
                                  disabled={savingProfileUserId === m.userId}
                                  className="py-1 px-2.5 rounded-md border border-border bg-bg-secondary text-foreground text-xs hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                                >
                                  {savingProfileUserId === m.userId
                                    ? '저장 중..'
                                    : '저장'}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingUser}
                                  disabled={savingProfileUserId === m.userId}
                                  className="py-1 px-2.5 rounded-md border border-border bg-transparent text-text-secondary text-xs hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  startEditingUser(m.userId, m.displayName)
                                }
                                className="py-1 px-2.5 rounded-md border border-border bg-bg-secondary text-foreground text-xs hover:bg-bg-tertiary transition-colors"
                              >
                                이름 수정
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-[13px] text-foreground">
                          <select
                            value={m.role}
                            onChange={(e) =>
                              updateBrandMemberRole(
                                m.userId,
                                e.target.value as BrandRole,
                              )
                            }
                            className="h-7 px-2 rounded-md border border-border bg-bg-secondary text-foreground text-xs"
                          >
                            {BRAND_ROLES.map((r) => (
                              <option
                                key={r.value}
                                value={r.value}
                                disabled={
                                  r.value === 'OWNER' &&
                                  isOwnerOptionDisabled(m.userId)
                                }
                              >
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3.5 text-[13px]">
                          <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-success/20 text-success text-[11px] font-semibold">
                            {STATUS_LABELS[m.status]}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-[13px] text-center">
                          <button
                            onClick={() => removeBrandMember(m.userId)}
                            className="py-1 px-2.5 rounded-md border border-border bg-transparent text-danger-500 font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors"
                            disabled={m.role === 'OWNER'}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Branch Members Tab */}
      {tab === 'branch' && (
        <div>
          {/* Branch 선택 */}
          <div className="mb-4">
            <BranchSelector />
            <div className="mt-2">
              <button
                onClick={fetchBranchMembers}
                disabled={!branchId || branchLoading}
                className="btn-primary h-9 px-4 text-[13px]"
              >
                {branchLoading ? '로딩...' : '조회'}
              </button>
            </div>
          </div>

          {/* 멤버 추가 */}
          {branchId && (
            <div className="card p-4 mb-4">
              <div className="mb-3 rounded-lg border border-primary-500/20 bg-primary-500/10 p-3">
                <div className="text-[11px] font-semibold text-primary-500">
                  현재 권한 부여 대상 가게
                </div>
                <div className="mt-1 text-sm font-bold text-foreground">
                  {selectedBranch?.name ?? '선택된 가게 확인 중'}
                </div>
                <div className="mt-1 text-[11px] text-text-secondary font-mono break-all">
                  {branchId}
                </div>
              </div>
              <div className="font-semibold mb-3 text-foreground">
                멤버 추가
              </div>
              <div className="mb-3 text-xs text-text-secondary">
                아래에서 추가하면 선택된 가게에 바로 권한이 부여됩니다.
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="User UUID"
                  className="input-field w-[280px]"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-border bg-bg-secondary text-foreground text-[13px]"
                >
                  <option value="">역할 선택</option>
                  {BRANCH_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addBranchMember}
                  disabled={adding || !newUserId}
                  className="btn-primary h-9 px-4 text-[13px]"
                >
                  {adding ? '추가 중...' : '추가'}
                </button>
              </div>
            </div>
          )}

          {/* 에러 */}
          {branchError && <p className="text-danger-500 mb-4">{branchError}</p>}

          {/* 멤버 목록 */}
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                    사용자
                  </th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                    역할
                  </th>
                  <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                    상태
                  </th>
                  <th className="text-center py-3 px-3.5 text-xs font-bold text-text-secondary">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {branchMembers.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-3 px-3.5 text-[13px] text-center text-text-tertiary"
                    >
                      {branchId ? '멤버가 없습니다.' : '가게를 선택하세요.'}
                    </td>
                  </tr>
                )}
                {branchMembers.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      {editingUserId === m.userId ? (
                        <input
                          type="text"
                          value={editingDisplayName}
                          onChange={(e) =>
                            setEditingDisplayName(e.target.value)
                          }
                          placeholder="이름"
                          className="h-8 w-full rounded-md border border-border bg-bg-secondary px-2 text-xs text-foreground"
                        />
                      ) : (
                        <div>{m.displayName || '-'}</div>
                      )}
                      {m.email ? (
                        <div className="text-[11px] text-text-secondary">
                          {m.email}
                        </div>
                      ) : null}
                      <div className="text-[11px] text-text-tertiary font-mono">
                        {m.userId.slice(0, 8)}...
                      </div>
                      <div className="mt-2 flex gap-2">
                        {editingUserId === m.userId ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void saveUserProfile(m.userId)}
                              disabled={savingProfileUserId === m.userId}
                              className="py-1 px-2.5 rounded-md border border-border bg-bg-secondary text-foreground text-xs hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                            >
                              {savingProfileUserId === m.userId
                                ? '저장 중..'
                                : '저장'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingUser}
                              disabled={savingProfileUserId === m.userId}
                              className="py-1 px-2.5 rounded-md border border-border bg-transparent text-text-secondary text-xs hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              startEditingUser(m.userId, m.displayName)
                            }
                            className="py-1 px-2.5 rounded-md border border-border bg-bg-secondary text-foreground text-xs hover:bg-bg-tertiary transition-colors"
                          >
                            이름 수정
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-foreground">
                      <select
                        value={m.role}
                        onChange={(e) =>
                          updateBranchMemberRole(
                            m.userId,
                            e.target.value as BranchRole,
                          )
                        }
                        className="h-7 px-2 rounded-md border border-border bg-bg-secondary text-foreground text-xs"
                      >
                        {BRANCH_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3.5 text-[13px]">
                      <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-success/20 text-success text-[11px] font-semibold">
                        {STATUS_LABELS[m.status]}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-[13px] text-center">
                      <button
                        onClick={() => removeBranchMember(m.userId)}
                        className="py-1 px-2.5 rounded-md border border-border bg-transparent text-danger-500 font-medium cursor-pointer text-xs hover:bg-bg-tertiary transition-colors"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="text-muted">로딩 중...</div>}>
      <MembersPageContent />
    </Suspense>
  );
}
