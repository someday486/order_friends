'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import BranchSelector from '@/components/admin/BranchSelector';
import { useSelectedBrand } from '@/hooks/useSelectedBrand';
import { useSelectedBranch } from '@/hooks/useSelectedBranch';
import { apiClient } from '@/lib/api-client';

type BrandRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';
type BranchRole = 'BRANCH_OWNER' | 'BRANCH_ADMIN' | 'STAFF' | 'VIEWER';
type MemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';
type Tab = 'brand' | 'branch';
type BrandInfo = { id: string; name: string };
type BranchInfo = { id: string; name: string };
type PendingUser = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  createdAt: string;
  isEmailConfirmed: boolean;
};
type BrandMember = {
  id: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: BrandRole;
  status: MemberStatus;
  createdAt: string;
};
type BranchMember = {
  id: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  role: BranchRole;
  status: MemberStatus;
  createdAt: string;
};
type ProfileRes = { id: string; displayName?: string | null };

const BRAND_ROLES: Array<{ value: BrandRole; label: string }> = [
  { value: 'OWNER', label: '오너' },
  { value: 'ADMIN', label: '관리자' },
  { value: 'MANAGER', label: '매니저' },
  { value: 'MEMBER', label: '멤버' },
];

const BRANCH_ROLES: Array<{ value: BranchRole; label: string }> = [
  { value: 'BRANCH_OWNER', label: '점장' },
  { value: 'BRANCH_ADMIN', label: '부점장' },
  { value: 'STAFF', label: '스태프' },
  { value: 'VIEWER', label: '조회 전용' },
];

const STATUS_LABELS: Record<MemberStatus, string> = {
  INVITED: '초대 중',
  ACTIVE: '활성',
  SUSPENDED: '중지',
  LEFT: '종료',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function statusClass(status: MemberStatus) {
  if (status === 'ACTIVE') return 'bg-success/20 text-success';
  if (status === 'SUSPENDED') return 'bg-danger-500/20 text-danger-500';
  if (status === 'LEFT') return 'bg-bg-tertiary text-text-secondary';
  return 'bg-warning/20 text-warning';
}

function MembersPageContent() {
  const search = useSearchParams();
  const initialTab = search?.get('tab') === 'branch' ? 'branch' : 'brand';
  const initialBranchId = search?.get('branchId');
  const { brandId, ready: brandReady, selectBrand } = useSelectedBrand();
  const { branchId, ready: branchReady, selectBranch, clearBranch } =
    useSelectedBranch();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>([]);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [branchMembers, setBranchMembers] = useState<BranchMember[]>([]);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [brandRole, setBrandRole] = useState<BrandRole>('MEMBER');
  const [branchRole, setBranchRole] = useState<BranchRole>('STAFF');
  const [addingBrand, setAddingBrand] = useState(false);
  const [addingBranch, setAddingBranch] = useState(false);
  const [selectedBranchInfo, setSelectedBranchInfo] = useState<BranchInfo | null>(
    null,
  );
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState('');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === brandId) ?? null,
    [brandId, brands],
  );
  const activeOwner = useMemo(
    () =>
      brandMembers.find(
        (member) => member.role === 'OWNER' && member.status === 'ACTIVE',
      ) ?? null,
    [brandMembers],
  );

  const canAssignOwner = (userId?: string) =>
    !activeOwner || activeOwner.userId === userId;

  useEffect(() => {
    if (initialBranchId && branchReady) selectBranch(initialBranchId);
  }, [branchReady, initialBranchId, selectBranch]);

  const applyDisplayName = (userId: string, displayName: string | null) => {
    setPending((items) =>
      items.map((item) => (item.id === userId ? { ...item, displayName } : item)),
    );
    setBrandMembers((items) =>
      items.map((item) =>
        item.userId === userId ? { ...item, displayName } : item,
      ),
    );
    setBranchMembers((items) =>
      items.map((item) =>
        item.userId === userId ? { ...item, displayName } : item,
      ),
    );
  };

  const fetchBrands = async () => {
    try {
      setBrandsError(null);
      setBrands(await apiClient.get<BrandInfo[]>('/admin/brands'));
    } catch (error) {
      setBrandsError(
        error instanceof Error ? error.message : '브랜드를 불러오지 못했습니다.',
      );
    }
  };

  const fetchPending = async () => {
    try {
      setPendingLoading(true);
      setPendingError(null);
      setPending(await apiClient.get<PendingUser[]>('/admin/members/pending'));
    } catch (error) {
      setPendingError(
        error instanceof Error
          ? error.message
          : '승인 대기 계정을 불러오지 못했습니다.',
      );
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchBrandMembers = async () => {
    if (!brandId) return setBrandMembers([]);
    try {
      setBrandLoading(true);
      setBrandError(null);
      setBrandMembers(
        await apiClient.get<BrandMember[]>(`/admin/members/brand/${brandId}`),
      );
    } catch (error) {
      setBrandError(
        error instanceof Error
          ? error.message
          : '브랜드 멤버를 불러오지 못했습니다.',
      );
    } finally {
      setBrandLoading(false);
    }
  };

  const fetchBranchMembers = async () => {
    if (!branchId) return setBranchMembers([]);
    try {
      setBranchLoading(true);
      setBranchError(null);
      setBranchMembers(
        await apiClient.get<BranchMember[]>(`/admin/members/branch/${branchId}`),
      );
    } catch (error) {
      setBranchError(
        error instanceof Error
          ? error.message
          : '매장 멤버를 불러오지 못했습니다.',
      );
    } finally {
      setBranchLoading(false);
    }
  };

  useEffect(() => {
    void fetchBrands();
    void fetchPending();
  }, []);

  useEffect(() => {
    if (!brandReady) return;
    if (!brandId) return setBrandMembers([]);
    void fetchBrandMembers();
  }, [brandId, brandReady]);

  useEffect(() => {
    if (!branchReady) return;
    if (!branchId) {
      setSelectedBranchInfo(null);
      return setBranchMembers([]);
    }
    void fetchBranchMembers();
    void (async () => {
      try {
        setSelectedBranchInfo(
          await apiClient.get<BranchInfo>(`/admin/branches/${branchId}`),
        );
      } catch {
        setSelectedBranchInfo(null);
      }
    })();
  }, [branchId, branchReady]);

  const handleBrandChange = (nextBrandId: string) => {
    if (!nextBrandId) return;
    selectBrand(nextBrandId);
    clearBranch();
    setSelectedBranchInfo(null);
  };

  const copyUserId = async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      toast.success('사용자 ID를 복사했습니다.');
    } catch {
      toast.error('사용자 ID를 복사하지 못했습니다.');
    }
  };

  const saveProfile = async (userId: string) => {
    try {
      setSavingUserId(userId);
      const data = await apiClient.patch<ProfileRes>(
        `/admin/members/profile/${userId}`,
        { displayName: editingDisplayName },
      );
      applyDisplayName(userId, data.displayName ?? null);
      setEditingUserId(null);
      setEditingDisplayName('');
      toast.success('이름을 저장했습니다.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '이름 저장에 실패했습니다.',
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const addBrandMember = async () => {
    if (!brandId || !selectedUserId) return;
    try {
      setAddingBrand(true);
      await apiClient.post(`/admin/members/brand/${brandId}`, {
        userId: selectedUserId,
        role: brandRole,
      });
      await Promise.all([fetchBrandMembers(), fetchPending()]);
      setSelectedUserId('');
      setBrandRole('MEMBER');
      toast.success('브랜드 권한을 부여했습니다.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '브랜드 권한 부여에 실패했습니다.',
      );
    } finally {
      setAddingBrand(false);
    }
  };

  const addBranchMember = async () => {
    if (!branchId || !selectedUserId) return;
    try {
      setAddingBranch(true);
      await apiClient.post('/admin/members/branch', {
        branchId,
        userId: selectedUserId,
        role: branchRole,
      });
      await Promise.all([fetchBranchMembers(), fetchPending()]);
      setSelectedUserId('');
      setBranchRole('STAFF');
      toast.success('매장 권한을 부여했습니다.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '매장 권한 부여에 실패했습니다.',
      );
    } finally {
      setAddingBranch(false);
    }
  };

  const updateBrandRole = async (userId: string, role: BrandRole) => {
    try {
      await apiClient.patch(`/admin/members/brand/${brandId}/${userId}`, { role });
      await fetchBrandMembers();
      toast.success('브랜드 역할을 변경했습니다.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '브랜드 역할 변경에 실패했습니다.',
      );
    }
  };

  const updateBranchRole = async (userId: string, role: BranchRole) => {
    try {
      await apiClient.patch(`/admin/members/branch/${branchId}/${userId}`, {
        role,
      });
      await fetchBranchMembers();
      toast.success('매장 역할을 변경했습니다.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '매장 역할 변경에 실패했습니다.',
      );
    }
  };

  const removeBrandMember = async (userId: string) => {
    if (!confirm('이 브랜드에서 해당 사용자를 제거하시겠습니까?')) return;
    try {
      await apiClient.delete(`/admin/members/brand/${brandId}/${userId}`);
      await Promise.all([fetchBrandMembers(), fetchPending()]);
      toast.success('브랜드 멤버를 제거했습니다.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '브랜드 멤버 제거에 실패했습니다.',
      );
    }
  };

  const removeBranchMember = async (userId: string) => {
    if (!confirm('이 매장에서 해당 사용자를 제거하시겠습니까?')) return;
    try {
      await apiClient.delete(`/admin/members/branch/${branchId}/${userId}`);
      await Promise.all([fetchBranchMembers(), fetchPending()]);
      toast.success('매장 멤버를 제거했습니다.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '매장 멤버 제거에 실패했습니다.',
      );
    }
  };

  const startEdit = (userId: string, displayName?: string | null) => {
    setEditingUserId(userId);
    setEditingDisplayName(displayName ?? '');
  };

  const nameBlock = (userId: string, displayName?: string | null) =>
    editingUserId === userId ? (
      <div className="space-y-2">
        <input
          value={editingDisplayName}
          onChange={(e) => setEditingDisplayName(e.target.value)}
          placeholder="이름 입력"
          className="input-field h-9 w-full text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void saveProfile(userId)}
            disabled={savingUserId === userId}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-bg-tertiary disabled:opacity-50"
          >
            {savingUserId === userId ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => setEditingUserId(null)}
            disabled={savingUserId === userId}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    ) : (
      <div>
        <div className="font-semibold text-foreground">
          {displayName?.trim() || '이름 없음'}
        </div>
        <button
          type="button"
          onClick={() => startEdit(userId, displayName)}
          className="mt-2 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-bg-tertiary"
        >
          이름 수정
        </button>
      </div>
    );

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h1 className="text-[22px] font-extrabold text-foreground">
          가입 승인 및 권한 부여
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          대기 계정 선택, 브랜드 또는 매장 선택, 역할 지정 순서로 한 화면에서
          처리할 수 있게 정리했습니다.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">승인 대기 계정</h2>
              <p className="mt-1 text-sm text-text-secondary">
                아직 활성 멤버십이 없는 가입 계정입니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchPending()}
              disabled={pendingLoading}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-bg-tertiary disabled:opacity-50"
            >
              {pendingLoading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>

          {pendingError ? (
            <div className="mt-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-500">
              {pendingError}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {pending.length === 0 && !pendingLoading ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-tertiary">
                승인 대기 계정이 없습니다.
              </div>
            ) : null}

            {pending.map((user) => (
              <article
                key={user.id}
                className="rounded-2xl border border-border bg-bg-secondary p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-base font-bold text-foreground">
                        {user.email ?? '이메일 정보 없음'}
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          user.isEmailConfirmed
                            ? 'bg-success/20 text-success'
                            : 'bg-warning/20 text-warning'
                        }`}
                      >
                        {user.isEmailConfirmed
                          ? '이메일 인증 완료'
                          : '이메일 인증 필요'}
                      </span>
                    </div>
                    <div className="mt-2 max-w-xl">{nameBlock(user.id, user.displayName)}</div>
                    <div className="mt-2 text-xs text-text-secondary">
                      가입일 {formatDate(user.createdAt)}
                    </div>
                    <div className="mt-1 break-all font-mono text-[11px] text-text-tertiary">
                      {user.id}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyUserId(user.id)}
                      className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-bg-tertiary"
                    >
                      ID 복사
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setTab('brand');
                      }}
                      className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-bg-tertiary"
                    >
                      브랜드 승인
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setTab('branch');
                      }}
                      className="rounded-md bg-primary-500 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600"
                    >
                      매장 승인
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">현재 선택 상태</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  사용자와 대상 위치를 한 번에 확인합니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab('brand')}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${
                    tab === 'brand'
                      ? 'bg-primary-500 text-white'
                      : 'border border-border text-foreground hover:bg-bg-tertiary'
                  }`}
                >
                  브랜드
                </button>
                <button
                  type="button"
                  onClick={() => setTab('branch')}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${
                    tab === 'branch'
                      ? 'bg-primary-500 text-white'
                      : 'border border-border text-foreground hover:bg-bg-tertiary'
                  }`}
                >
                  매장
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-border bg-bg-secondary p-4">
                <div className="text-xs font-semibold text-text-secondary">
                  선택된 사용자 ID
                </div>
                <input
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  placeholder="승인할 사용자 ID"
                  className="input-field mt-2 h-10 w-full font-mono text-sm"
                />
              </div>

              <div className="rounded-xl border border-border bg-bg-secondary p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-text-secondary">
                      선택된 브랜드
                    </div>
                    <div className="mt-1 text-sm font-bold text-foreground">
                      {selectedBrand?.name ?? '선택된 브랜드 없음'}
                    </div>
                    <div className="mt-1 text-[11px] text-text-tertiary">
                      {brandId ?? '브랜드 ID 없음'}
                    </div>
                  </div>
                  <Link
                    href="/admin/brand"
                    className="text-sm text-text-secondary hover:text-foreground"
                  >
                    브랜드 관리
                  </Link>
                </div>
                <select
                  value={brandId ?? ''}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="input-field mt-3 h-10 w-full text-sm"
                >
                  <option value="">브랜드를 선택하세요</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
                {brandsError ? (
                  <div className="mt-2 text-xs text-danger-500">{brandsError}</div>
                ) : null}
              </div>

              <div className="rounded-xl border border-border bg-bg-secondary p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-text-secondary">
                      선택된 매장
                    </div>
                    <div className="mt-1 text-sm font-bold text-foreground">
                      {selectedBranchInfo?.name ?? '선택된 매장 없음'}
                    </div>
                    <div className="mt-1 text-[11px] text-text-tertiary">
                      {branchId ?? '매장 ID 없음'}
                    </div>
                  </div>
                  <Link
                    href="/admin/stores"
                    className="text-sm text-text-secondary hover:text-foreground"
                  >
                    매장 관리
                  </Link>
                </div>
                <div className="mt-3">
                  <BranchSelector label="권한을 부여할 매장" />
                </div>
              </div>
            </div>
          </section>

          <section className="card p-5">
            {tab === 'brand' ? (
              <>
                <h2 className="text-base font-bold text-foreground">브랜드 권한 부여</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  브랜드 전체 운영 권한이 필요한 경우 사용합니다.
                </p>
                <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-text-secondary">
                  <div className="font-semibold text-warning">
                    오너는 브랜드당 1명만 활성 상태로 둘 수 있습니다.
                  </div>
                  <div className="mt-1">
                    {activeOwner
                      ? `현재 오너: ${activeOwner.displayName || activeOwner.userId}`
                      : '현재 활성 오너가 없습니다.'}
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <select
                    value={brandRole}
                    onChange={(e) => setBrandRole(e.target.value as BrandRole)}
                    className="input-field h-10 w-full text-sm"
                  >
                    {BRAND_ROLES.map((role) => (
                      <option
                        key={role.value}
                        value={role.value}
                        disabled={
                          role.value === 'OWNER' &&
                          !canAssignOwner(selectedUserId || undefined)
                        }
                      >
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void addBrandMember()}
                    disabled={!brandId || !selectedUserId || addingBrand}
                    className="btn-primary h-10 px-4 text-sm disabled:opacity-50"
                  >
                    {addingBrand ? '권한 부여 중...' : '이 브랜드에 추가'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-bold text-foreground">매장 권한 부여</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  실제 매장 운영 계정이면 매장 권한을 먼저 연결하세요.
                </p>
                {!brandId ? (
                  <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                    먼저 브랜드를 선택해야 매장을 고를 수 있습니다.
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3">
                  <select
                    value={branchRole}
                    onChange={(e) => setBranchRole(e.target.value as BranchRole)}
                    className="input-field h-10 w-full text-sm"
                  >
                    {BRANCH_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void addBranchMember()}
                    disabled={!branchId || !selectedUserId || addingBranch}
                    className="btn-primary h-10 px-4 text-sm disabled:opacity-50"
                  >
                    {addingBranch ? '권한 부여 중...' : '이 매장에 추가'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">브랜드 멤버 목록</h2>
              <p className="mt-1 text-sm text-text-secondary">
                선택된 브랜드의 현재 권한 상태입니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchBrandMembers()}
              disabled={!brandId || brandLoading}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-bg-tertiary disabled:opacity-50"
            >
              {brandLoading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
          {brandError ? (
            <div className="mt-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-500">
              {brandError}
            </div>
          ) : null}
          {!brandId ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-tertiary">
              브랜드를 선택하면 멤버 목록이 보입니다.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary">사용자</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary">역할</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary">상태</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary">생성일</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-text-secondary">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {brandMembers.length === 0 ? (
                    <tr className="border-t border-border">
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-text-tertiary">
                        등록된 브랜드 멤버가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    brandMembers.map((member) => (
                      <tr key={member.id} className="border-t border-border">
                        <td className="px-3 py-3 align-top text-sm">
                          <div className="min-w-[180px]">
                            {nameBlock(member.userId, member.displayName)}
                            {member.email ? <div className="mt-2 text-xs text-text-secondary">{member.email}</div> : null}
                            <div className="mt-1 font-mono text-[11px] text-text-tertiary">{member.userId}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <select
                            value={member.role}
                            onChange={(e) => void updateBrandRole(member.userId, e.target.value as BrandRole)}
                            className="input-field h-9 min-w-[120px] text-sm"
                          >
                            {BRAND_ROLES.map((role) => (
                              <option
                                key={role.value}
                                value={role.value}
                                disabled={role.value === 'OWNER' && !canAssignOwner(member.userId)}
                              >
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(member.status)}`}>
                            {STATUS_LABELS[member.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-sm text-text-secondary">{formatDate(member.createdAt)}</td>
                        <td className="px-3 py-3 align-top text-center">
                          <button
                            type="button"
                            onClick={() => void removeBrandMember(member.userId)}
                            disabled={member.role === 'OWNER'}
                            className="rounded-md border border-border px-3 py-2 text-sm text-danger-500 hover:bg-bg-tertiary disabled:opacity-50"
                          >
                            제거
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">매장 멤버 목록</h2>
              <p className="mt-1 text-sm text-text-secondary">
                선택된 매장의 현재 권한 상태입니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchBranchMembers()}
              disabled={!branchId || branchLoading}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-bg-tertiary disabled:opacity-50"
            >
              {branchLoading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
          {branchError ? (
            <div className="mt-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-500">
              {branchError}
            </div>
          ) : null}
          {!branchId ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-tertiary">
              매장을 선택하면 멤버 목록이 보입니다.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary">사용자</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary">역할</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary">상태</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-text-secondary">생성일</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-text-secondary">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {branchMembers.length === 0 ? (
                    <tr className="border-t border-border">
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-text-tertiary">
                        등록된 매장 멤버가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    branchMembers.map((member) => (
                      <tr key={member.id} className="border-t border-border">
                        <td className="px-3 py-3 align-top text-sm">
                          <div className="min-w-[180px]">
                            {nameBlock(member.userId, member.displayName)}
                            {member.email ? <div className="mt-2 text-xs text-text-secondary">{member.email}</div> : null}
                            <div className="mt-1 font-mono text-[11px] text-text-tertiary">{member.userId}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <select
                            value={member.role}
                            onChange={(e) => void updateBranchRole(member.userId, e.target.value as BranchRole)}
                            className="input-field h-9 min-w-[120px] text-sm"
                          >
                            {BRANCH_ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(member.status)}`}>
                            {STATUS_LABELS[member.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-sm text-text-secondary">{formatDate(member.createdAt)}</td>
                        <td className="px-3 py-3 align-top text-center">
                          <button
                            type="button"
                            onClick={() => void removeBranchMember(member.userId)}
                            className="rounded-md border border-border px-3 py-2 text-sm text-danger-500 hover:bg-bg-tertiary"
                          >
                            제거
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-text-secondary">로딩 중...</div>}>
      <MembersPageContent />
    </Suspense>
  );
}
