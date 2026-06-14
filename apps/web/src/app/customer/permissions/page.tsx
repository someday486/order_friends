'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Clock, Search, UserPlus, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Switch } from '@/components/common/Switch';

type Brand = { id: string; name: string; myRole?: string | null };
type Branch = {
  id: string;
  name: string;
  brandId: string;
  myRole?: string | null;
};

type BrandMemberApiResponse = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: string;
  status: string;
  createdAt: string;
};

type BranchMemberApiResponse = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: string;
  status: string;
  createdAt: string;
  branchId: string;
};

type Role = 'BRAND_OWNER' | 'MANAGER' | 'STAFF';
type Status = 'ACTIVE' | 'INVITED' | 'INACTIVE';
type InviteRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MEMBER'
  | 'BRANCH_OWNER'
  | 'BRANCH_ADMIN'
  | 'STAFF'
  | 'VIEWER';

type PermissionMemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  brandId: string;
  brandName: string;
  branchId: string | null;
  branchName: string | null;
  role: Role;
  rawRole: InviteRole;
  status: Status;
  joinedAt?: string;
};

type InviteModalProps = {
  open: boolean;
  email: string;
  role: InviteRole;
  branchId: string;
  branches: Branch[];
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: InviteRole) => void;
  onBranchChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void> | void;
};

type RoleChangeModalProps = {
  open: boolean;
  member: PermissionMemberRow | null;
  role: InviteRole;
  status: Status;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onRoleChange: (value: InviteRole) => void;
  onStatusChange: (value: Status) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void> | void;
};

type MemberHistoryAction =
  | 'INVITE_SENT'
  | 'ROLE_CHANGED'
  | 'STATUS_CHANGED'
  | 'ROLE_STATUS_CHANGED';

type MemberHistoryScope = 'BRAND' | 'BRANCH';
type MemberHistoryFilter = 'ALL' | MemberHistoryAction;

type MemberHistoryItem = {
  id: string;
  actionType: MemberHistoryAction;
  scopeType: MemberHistoryScope;
  brandId: string;
  branchId: string | null;
  actorUserId: string;
  actorDisplayName: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetDisplayName: string | null;
  targetEmail: string | null;
  beforeRole: string | null;
  afterRole: string | null;
  beforeStatus: string | null;
  afterStatus: string | null;
  createdAt: string;
};

type HistoryModalProps = {
  open: boolean;
  branchId: string;
  branchName: string | null;
  loading: boolean;
  error: string | null;
  items: MemberHistoryItem[];
  onClose: () => void;
};

const BRAND_INVITE_ROLE_OPTIONS: Array<{ value: InviteRole; label: string }> = [
  { value: 'OWNER', label: '브랜드 오너' },
  { value: 'ADMIN', label: '매니저' },
  { value: 'MEMBER', label: '직원' },
];

const BRANCH_INVITE_ROLE_OPTIONS: Array<{ value: InviteRole; label: string }> =
  [
    { value: 'BRANCH_OWNER', label: '스토어 오너' },
    { value: 'BRANCH_ADMIN', label: '매니저' },
    { value: 'STAFF', label: '직원' },
    { value: 'VIEWER', label: '조회 전용' },
  ];

const ROLE_LABEL: Record<Role, string> = {
  BRAND_OWNER: '브랜드 오너',
  MANAGER: '매니저',
  STAFF: '직원',
};

const ROLE_BADGE: Record<Role, string> = {
  BRAND_OWNER: 'bg-primary-500/15 text-primary-500',
  MANAGER: 'bg-success/15 text-success',
  STAFF: 'bg-neutral-500/15 text-text-secondary',
};

const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: '활성',
  INVITED: '초대대기',
  INACTIVE: '비활성',
};

const STATUS_BADGE: Record<Status, string> = {
  ACTIVE: 'bg-success/15 text-success',
  INVITED: 'bg-warning-500/15 text-warning-500',
  INACTIVE: 'bg-neutral-500/15 text-text-tertiary',
};

const HISTORY_ACTION_LABEL: Record<MemberHistoryAction, string> = {
  INVITE_SENT: '초대',
  ROLE_CHANGED: '권한 변경',
  STATUS_CHANGED: '상태 변경',
  ROLE_STATUS_CHANGED: '권한 + 상태',
};

function mapBrandRole(raw: string): Role {
  if (raw === 'OWNER') return 'BRAND_OWNER';
  if (raw === 'ADMIN') return 'MANAGER';
  return 'STAFF';
}

function mapBranchRole(raw: string): Role {
  if (raw === 'BRANCH_OWNER' || raw === 'BRANCH_ADMIN') return 'MANAGER';
  return 'STAFF';
}

function mapStatus(raw: string): Status {
  if (raw === 'ACTIVE') return 'ACTIVE';
  if (raw === 'INVITED') return 'INVITED';
  return 'INACTIVE';
}

function displayName(m: {
  displayName: string | null;
  email: string | null;
  userId: string;
}): string {
  return m.displayName || m.email?.split('@')[0] || m.userId.slice(0, 8);
}

function getDefaultInviteRole(branchId: string): InviteRole {
  return branchId ? 'STAFF' : 'MEMBER';
}

function getInviteRoleOptions(branchId: string) {
  return branchId ? BRANCH_INVITE_ROLE_OPTIONS : BRAND_INVITE_ROLE_OPTIONS;
}

function getRoleLabelByRawRole(role: InviteRole) {
  return (
    [...BRAND_INVITE_ROLE_OPTIONS, ...BRANCH_INVITE_ROLE_OPTIONS].find(
      (option) => option.value === role,
    )?.label ?? role
  );
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getHistoryDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHistoryDateGroup(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function getHistoryActorLabel(item: MemberHistoryItem) {
  return (
    item.actorDisplayName || item.actorEmail || item.actorUserId.slice(0, 8)
  );
}

function getHistoryTargetLabel(item: MemberHistoryItem) {
  return (
    item.targetDisplayName ||
    item.targetEmail ||
    item.targetUserId ||
    '대상 없음'
  );
}

function getHistoryMessage(item: MemberHistoryItem) {
  const actor = getHistoryActorLabel(item);
  const target = getHistoryTargetLabel(item);
  const beforeRole = item.beforeRole
    ? getRoleLabelByRawRole(item.beforeRole as InviteRole)
    : null;
  const afterRole = item.afterRole
    ? getRoleLabelByRawRole(item.afterRole as InviteRole)
    : null;
  const beforeStatus = item.beforeStatus
    ? item.beforeStatus === 'SUSPENDED'
      ? '비활성화'
      : STATUS_LABEL[mapStatus(item.beforeStatus)]
    : null;
  const afterStatus = item.afterStatus
    ? item.afterStatus === 'SUSPENDED'
      ? '비활성화'
      : STATUS_LABEL[mapStatus(item.afterStatus)]
    : null;

  if (item.actionType === 'INVITE_SENT') {
    return `${actor}님이 ${target}님을 초대했습니다.`;
  }
  if (item.actionType === 'ROLE_CHANGED') {
    return `${actor}님이 ${target}님의 권한을 ${beforeRole ?? '-'}에서 ${afterRole ?? '-'}로 변경했습니다.`;
  }
  if (item.actionType === 'STATUS_CHANGED') {
    return `${actor}님이 ${target}님의 상태를 ${beforeStatus ?? '-'}에서 ${afterStatus ?? '-'}로 변경했습니다.`;
  }
  return `${actor}님이 ${target}님의 권한과 상태를 함께 변경했습니다.`;
}

export default function PermissionsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<PermissionMemberRow[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [searchInput, setSearchInput] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('MEMBER');
  const [inviteBranchId, setInviteBranchId] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [roleChangeOpen, setRoleChangeOpen] = useState(false);
  const [roleChangeMember, setRoleChangeMember] =
    useState<PermissionMemberRow | null>(null);
  const [roleChangeRole, setRoleChangeRole] = useState<InviteRole>('MEMBER');
  const [roleChangeStatus, setRoleChangeStatus] = useState<Status>('ACTIVE');
  const [roleChangeSubmitting, setRoleChangeSubmitting] = useState(false);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<MemberHistoryItem[]>([]);

  const brandsRef = useRef<Brand[]>([]);
  useEffect(() => {
    brandsRef.current = brands;
  }, [brands]);

  useEffect(() => {
    apiClient
      .get<Brand[]>('/customer/brands')
      .then((data) => {
        setBrands(data);
        if (data.length > 0) setSelectedBrandId(data[0].id);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : '브랜드 목록을 불러올 수 없습니다',
        ),
      );
  }, []);

  const loadBrandData = useCallback(async (brandId: string) => {
    const brandName =
      brandsRef.current.find((b) => b.id === brandId)?.name ?? brandId;

    setLoading(true);
    setError(null);
    setMembers([]);
    setBranches([]);
    setSelectedBranchId('');

    try {
      const branchData = await apiClient.get<Branch[]>(
        `/customer/branches?brandId=${encodeURIComponent(brandId)}`,
      );
      setBranches(branchData);

      const [brandMembersRaw, ...branchMembersRaw] = await Promise.all([
        apiClient
          .get<BrandMemberApiResponse[]>(`/customer/members/brand/${brandId}`)
          .catch(() => [] as BrandMemberApiResponse[]),
        ...branchData.map((branch) =>
          apiClient
            .get<BranchMemberApiResponse[]>(
              `/customer/members/branch/${branch.id}`,
            )
            .then((data) =>
              data.map((m) => ({
                ...m,
                _branchId: branch.id,
                _branchName: branch.name,
              })),
            )
            .catch(
              () =>
                [] as (BranchMemberApiResponse & {
                  _branchId: string;
                  _branchName: string;
                })[],
            ),
        ),
      ]);

      const brandRows: PermissionMemberRow[] = (
        brandMembersRaw as BrandMemberApiResponse[]
      ).map((m) => ({
        id: `brand-${brandId}-${m.userId}`,
        userId: m.userId,
        name: displayName(m),
        email: m.email,
        brandId,
        brandName,
        branchId: null,
        branchName: null,
        role: mapBrandRole(m.role),
        rawRole: m.role as InviteRole,
        status: mapStatus(m.status),
        joinedAt: m.createdAt,
      }));

      const branchRows: PermissionMemberRow[] = (
        branchMembersRaw as (BranchMemberApiResponse & {
          _branchId: string;
          _branchName: string;
        })[][]
      )
        .flat()
        .map((m) => ({
          id: `branch-${m._branchId}-${m.userId}`,
          userId: m.userId,
          name: displayName(m),
          email: m.email,
          brandId,
          brandName,
          branchId: m._branchId,
          branchName: m._branchName,
          role: mapBranchRole(m.role),
          rawRole: m.role as InviteRole,
          status: mapStatus(m.status),
          joinedAt: m.createdAt,
        }));

      setMembers([...brandRows, ...branchRows]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '멤버 목록을 불러올 수 없습니다',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedBrandId) return;
    void loadBrandData(selectedBrandId);
  }, [selectedBrandId, loadBrandData]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (selectedBranchId && m.branchId !== selectedBranchId) {
        return false;
      }
      if (roleFilter && m.role !== roleFilter) return false;
      if (searchInput.trim()) {
        const q = searchInput.toLowerCase();
        if (
          !m.name.toLowerCase().includes(q) &&
          !(m.email ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [members, roleFilter, searchInput, selectedBranchId]);

  const totalMembers = useMemo(
    () => new Set(members.map((m) => m.userId)).size,
    [members],
  );
  const totalManagers = useMemo(
    () =>
      new Set(members.filter((m) => m.role === 'MANAGER').map((m) => m.userId))
        .size,
    [members],
  );
  const totalBranches = branches.length;
  const availableBranches = branches;

  const resetInviteForm = useCallback(() => {
    setInviteEmail('');
    setInviteBranchId('');
    setInviteRole('MEMBER');
    setInviteError(null);
  }, []);

  const handleReset = () => {
    setSelectedBranchId('');
    setRoleFilter('');
    setSearchInput('');
  };

  const handleOpenInvite = () => {
    const nextBranchId = selectedBranchId || '';
    setInviteBranchId(nextBranchId);
    setInviteRole(getDefaultInviteRole(nextBranchId));
    setInviteEmail('');
    setInviteError(null);
    setInviteOpen(true);
  };

  const handleCloseInvite = () => {
    if (inviteSubmitting) return;
    setInviteOpen(false);
    resetInviteForm();
  };

  const handleInviteBranchChange = (value: string) => {
    setInviteBranchId(value);
    setInviteRole(getDefaultInviteRole(value));
    setInviteError(null);
  };

  const handleInviteSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedBrandId) {
      setInviteError('초대할 브랜드를 먼저 선택해주세요.');
      return;
    }

    if (!inviteEmail.trim()) {
      setInviteError('이메일을 입력해주세요.');
      return;
    }

    setInviteSubmitting(true);
    setInviteError(null);

    try {
      const email = inviteEmail.trim();

      if (inviteBranchId) {
        await apiClient.post(
          `/customer/members/branch/${inviteBranchId}/invite`,
          {
            email,
            role: inviteRole,
          },
        );
      } else {
        await apiClient.post(
          `/customer/members/brand/${selectedBrandId}/invite`,
          {
            email,
            role: inviteRole,
          },
        );
      }

      setInviteOpen(false);
      resetInviteForm();
      await loadBrandData(selectedBrandId);
    } catch (e) {
      setInviteError(
        e instanceof Error ? e.message : '멤버 초대에 실패했습니다.',
      );
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleOpenRoleChange = (member: PermissionMemberRow) => {
    setRoleChangeMember(member);
    setRoleChangeRole(member.rawRole);
    setRoleChangeStatus(member.status);
    setRoleChangeError(null);
    setRoleChangeOpen(true);
  };

  const handleCloseRoleChange = () => {
    if (roleChangeSubmitting) return;
    setRoleChangeOpen(false);
    setRoleChangeMember(null);
    setRoleChangeRole('MEMBER');
    setRoleChangeStatus('ACTIVE');
    setRoleChangeError(null);
  };

  const handleRoleChangeSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!roleChangeMember) {
      setRoleChangeError('변경할 멤버를 찾을 수 없습니다.');
      return;
    }

    setRoleChangeSubmitting(true);
    setRoleChangeError(null);

    try {
      if (roleChangeMember.branchId) {
        await apiClient.patch(
          `/customer/members/branch/${roleChangeMember.branchId}/${roleChangeMember.userId}`,
          {
            role: roleChangeRole,
            status:
              roleChangeStatus === 'INACTIVE' ? 'SUSPENDED' : roleChangeStatus,
          },
        );
      } else {
        await apiClient.patch(
          `/customer/members/brand/${roleChangeMember.brandId}/${roleChangeMember.userId}`,
          {
            role: roleChangeRole,
            status:
              roleChangeStatus === 'INACTIVE' ? 'SUSPENDED' : roleChangeStatus,
          },
        );
      }

      handleCloseRoleChange();
      await loadBrandData(selectedBrandId);
    } catch (e) {
      setRoleChangeError(
        e instanceof Error ? e.message : '권한 변경에 실패했습니다.',
      );
    } finally {
      setRoleChangeSubmitting(false);
    }
  };

  const handleOpenHistory = async () => {
    if (!selectedBrandId) return;

    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const data = selectedBranchId
        ? await apiClient.get<MemberHistoryItem[]>(
            `/customer/members/branch/${selectedBranchId}/history`,
          )
        : await apiClient.get<MemberHistoryItem[]>(
            `/customer/members/brand/${selectedBrandId}/history`,
          );
      setHistoryItems(data);
    } catch (e) {
      setHistoryError(
        e instanceof Error ? e.message : '변경 이력을 불러올 수 없습니다.',
      );
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistory = () => {
    if (historyLoading) return;
    setHistoryOpen(false);
    setHistoryError(null);
    setHistoryItems([]);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground m-0">
            권한관리
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            브랜드 및 스토어의 멤버와 역할을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              void handleOpenHistory();
            }}
            disabled={!selectedBrandId}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-bg-secondary text-sm font-semibold text-foreground hover:bg-bg-tertiary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Clock className="w-4 h-4 text-text-secondary" />
            변경 이력
          </button>
          <button
            type="button"
            onClick={handleOpenInvite}
            disabled={!selectedBrandId}
            className="btn-primary flex items-center gap-1.5 h-9 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4" />
            멤버 초대
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs text-text-secondary font-semibold mb-1.5">
            전체 멤버
          </div>
          <div className="text-3xl font-extrabold text-foreground">
            {loading ? '-' : totalMembers}
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            등록된 전체 구성원
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-text-secondary font-semibold mb-1.5">
            매니저
          </div>
          <div className="text-3xl font-extrabold text-foreground">
            {loading ? '-' : totalManagers}
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            스토어 담당 매니저
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-text-secondary font-semibold mb-1.5">
            운영 스토어
          </div>
          <div className="text-3xl font-extrabold text-foreground">
            {loading ? '-' : totalBranches}
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            현재 운영 중인 스토어
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-full min-w-0 sm:flex-1 sm:min-w-[140px]">
          <label className="block text-xs text-text-secondary mb-1.5 font-semibold">
            브랜드
          </label>
          <select
            value={selectedBrandId}
            onChange={(e) => {
              setSelectedBrandId(e.target.value);
            }}
            className="input-field h-9 text-sm w-full"
          >
            {brands.length === 0 && <option value="">브랜드 없음</option>}
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full min-w-0 sm:flex-1 sm:min-w-[140px]">
          <label className="block text-xs text-text-secondary mb-1.5 font-semibold">
            스토어
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="input-field h-9 text-sm w-full"
            disabled={availableBranches.length === 0}
          >
            <option value="">전체 스토어</option>
            {availableBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full min-w-0 sm:flex-1 sm:min-w-[130px]">
          <label className="block text-xs text-text-secondary mb-1.5 font-semibold">
            역할
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | '')}
            className="input-field h-9 text-sm w-full"
          >
            <option value="">전체 역할</option>
            <option value="BRAND_OWNER">브랜드 오너</option>
            <option value="MANAGER">매니저</option>
            <option value="STAFF">직원</option>
          </select>
        </div>

        <div className="w-full sm:w-52">
          <label className="block text-xs text-text-secondary mb-1.5 font-semibold">
            검색
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="이름, 이메일 검색"
              className="input-field h-9 text-sm w-full pl-9 pr-8"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-end w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="h-9 px-4 rounded-lg border border-border bg-bg-secondary text-sm font-semibold text-text-secondary hover:bg-bg-tertiary transition-colors cursor-pointer w-full sm:w-auto"
          >
            초기화
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-danger-500 rounded-xl p-4 bg-danger-500/10 text-danger-500 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_252px] gap-5">
        <div>
          {loading ? (
            <div className="border border-border rounded-xl p-12 bg-bg-secondary text-center">
              <div className="text-sm text-text-secondary">불러오는 중...</div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="border border-border rounded-xl p-12 bg-bg-secondary text-center">
              <div className="text-base text-text-secondary mb-1">
                {members.length === 0
                  ? '등록된 멤버가 없습니다'
                  : '조건에 맞는 멤버가 없습니다'}
              </div>
              {members.length > 0 && (
                <div className="text-sm text-text-tertiary">
                  필터 조건을 변경하거나 초기화해주세요
                </div>
              )}
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full border-collapse min-w-[680px]">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                      이름
                    </th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                      이메일
                    </th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                      소속 브랜드
                    </th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                      소속 스토어
                    </th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                      역할
                    </th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                      상태
                    </th>
                    <th className="text-left py-3 px-3.5 text-xs font-bold text-text-secondary">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="border-t border-border hover:bg-bg-tertiary transition-colors"
                    >
                      <td className="py-3 px-3.5">
                        <span className="text-sm font-semibold text-foreground">
                          {member.name}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="text-sm text-text-secondary">
                          {member.email ?? '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="text-sm text-foreground">
                          {member.brandName}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="text-sm text-foreground">
                          {member.branchName ?? '-'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${ROLE_BADGE[member.role]}`}
                        >
                          {ROLE_LABEL[member.role]}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold ${STATUS_BADGE[member.status]}`}
                        >
                          {STATUS_LABEL[member.status]}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenRoleChange(member)}
                            className="h-7 px-2.5 rounded border border-border bg-bg-secondary text-xs font-semibold text-foreground hover:bg-bg-tertiary transition-colors cursor-pointer"
                          >
                            권한변경
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && (
            <div className="mt-2 text-xs text-text-tertiary">
              총 {filteredMembers.length}명 표시 중
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="text-sm font-bold text-foreground mb-3">
              역할 안내
            </div>
            <div className="space-y-3">
              <div>
                <span
                  className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold mb-1.5 ${ROLE_BADGE.BRAND_OWNER}`}
                >
                  브랜드 오너
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  브랜드와 모든 스토어를 관리하고 멤버 초대 및 권한 변경이
                  가능합니다.
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <span
                  className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold mb-1.5 ${ROLE_BADGE.MANAGER}`}
                >
                  매니저
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  담당 스토어의 주문, 상품, 재고 관리가 가능합니다.
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <span
                  className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold mb-1.5 ${ROLE_BADGE.STAFF}`}
                >
                  직원
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  주문 조회 및 기본 운영 업무를 담당합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="text-sm font-bold text-foreground mb-2">
              초대 안내
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              멤버 초대 시 등록된 이메일로 초대 링크가 발송됩니다. 수락 전까지{' '}
              <span className="font-semibold text-warning-500">초대대기</span>{' '}
              상태로 표시됩니다.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="text-sm font-bold text-foreground mb-3">
              상태 안내
            </div>
            <div className="flex flex-col gap-2">
              {(['ACTIVE', 'INVITED', 'INACTIVE'] as Status[]).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold ${STATUS_BADGE[s]}`}
                  >
                    {STATUS_LABEL[s]}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {s === 'ACTIVE' && '정상 접근 가능'}
                    {s === 'INVITED' && '초대 수락 대기 중'}
                    {s === 'INACTIVE' && '접근 제한됨'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <InviteModal
        open={inviteOpen}
        email={inviteEmail}
        role={inviteRole}
        branchId={inviteBranchId}
        branches={branches}
        submitting={inviteSubmitting}
        error={inviteError}
        onClose={handleCloseInvite}
        onEmailChange={setInviteEmail}
        onRoleChange={setInviteRole}
        onBranchChange={handleInviteBranchChange}
        onSubmit={handleInviteSubmit}
      />

      <RoleChangeModal
        open={roleChangeOpen}
        member={roleChangeMember}
        role={roleChangeRole}
        status={roleChangeStatus}
        submitting={roleChangeSubmitting}
        error={roleChangeError}
        onClose={handleCloseRoleChange}
        onRoleChange={setRoleChangeRole}
        onStatusChange={setRoleChangeStatus}
        onSubmit={handleRoleChangeSubmit}
      />

      <HistoryModal
        open={historyOpen}
        branchId={selectedBranchId}
        branchName={
          branches.find((branch) => branch.id === selectedBranchId)?.name ??
          null
        }
        loading={historyLoading}
        error={historyError}
        items={historyItems}
        onClose={handleCloseHistory}
      />
    </div>
  );
}

function InviteModal({
  open,
  email,
  role,
  branchId,
  branches,
  submitting,
  error,
  onClose,
  onEmailChange,
  onRoleChange,
  onBranchChange,
  onSubmit,
}: InviteModalProps) {
  if (!open) return null;

  const roleOptions = getInviteRoleOptions(branchId);
  const targetLabel = branchId ? '스토어 초대' : '브랜드 초대';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">멤버 초대</h2>
            <p className="mt-1 text-sm text-text-secondary">
              초대할 이메일과 역할을 입력해주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            void onSubmit(e);
          }}
          className="px-5 py-4"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                초대 범위
              </label>
              <select
                value={branchId}
                onChange={(e) => onBranchChange(e.target.value)}
                className="input-field h-10 text-sm w-full"
                disabled={submitting}
              >
                <option value="">브랜드 전체</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-text-tertiary">
                현재 {targetLabel}로 발송됩니다.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="invite@example.com"
                className="input-field h-10 text-sm w-full"
                disabled={submitting}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                역할
              </label>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value as InviteRole)}
                className="input-field h-10 text-sm w-full"
                disabled={submitting}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-xl border border-danger-500 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
                {error}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 px-4 rounded-lg border border-border bg-bg-secondary text-sm font-semibold text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-10 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '초대 중...' : '초대 보내기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoleChangeModal({
  open,
  member,
  role,
  status,
  submitting,
  error,
  onClose,
  onRoleChange,
  onStatusChange,
  onSubmit,
}: RoleChangeModalProps) {
  if (!open || !member) return null;

  const roleOptions = getInviteRoleOptions(member.branchId ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">권한 변경</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {member.name}님의 권한을 변경합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            void onSubmit(e);
          }}
          className="px-5 py-4"
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-secondary px-4 py-3">
              <div className="text-xs font-semibold text-text-secondary">
                대상
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {member.name}
              </div>
              <div className="mt-0.5 text-xs text-text-tertiary">
                {member.email ?? '이메일 없음'}
              </div>
              <div className="mt-2 text-xs text-text-secondary">
                현재 권한:{' '}
                <span className="font-semibold text-foreground">
                  {getRoleLabelByRawRole(member.rawRole)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                변경할 역할
              </label>
              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value as InviteRole)}
                className="input-field h-10 text-sm w-full"
                disabled={submitting}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-border bg-bg-secondary px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-text-secondary">
                    상태 변경
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {status === 'ACTIVE' ? '활성화' : '비활성화'}
                  </div>
                  <div className="mt-0.5 text-xs text-text-tertiary">
                    비활성화하면 이 멤버의 접근이 제한됩니다.
                  </div>
                </div>
                <Switch
                  checked={status === 'ACTIVE'}
                  onChange={(checked) =>
                    onStatusChange(checked ? 'ACTIVE' : 'INACTIVE')
                  }
                  disabled={submitting}
                  ariaLabel={`${member.name} 상태 변경`}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-danger-500 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
                {error}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 px-4 rounded-lg border border-border bg-bg-secondary text-sm font-semibold text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-10 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '저장 중...' : '변경 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({
  open,
  branchId,
  branchName,
  loading,
  error,
  items,
  onClose,
}: HistoryModalProps) {
  const [actionFilter, setActionFilter] = useState<MemberHistoryFilter>('ALL');
  const [keyword, setKeyword] = useState('');

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return items.filter((item) => {
      if (actionFilter !== 'ALL' && item.actionType !== actionFilter) {
        return false;
      }

      if (!normalizedKeyword) return true;

      const haystack = [
        getHistoryActorLabel(item),
        getHistoryTargetLabel(item),
        getHistoryMessage(item),
        HISTORY_ACTION_LABEL[item.actionType],
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedKeyword);
    });
  }, [actionFilter, items, keyword]);

  const groupedItems = useMemo(() => {
    const groups: Array<{
      dateKey: string;
      label: string;
      items: MemberHistoryItem[];
    }> = [];

    for (const item of filteredItems) {
      const dateKey = getHistoryDateKey(item.createdAt);
      const lastGroup = groups[groups.length - 1];

      if (!lastGroup || lastGroup.dateKey !== dateKey) {
        groups.push({
          dateKey,
          label: formatHistoryDateGroup(item.createdAt),
          items: [item],
        });
        continue;
      }

      lastGroup.items.push(item);
    }

    return groups;
  }, [filteredItems]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">변경 이력</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {branchId && branchName
                ? `${branchName} 멤버 이력을 확인합니다.`
                : '브랜드와 스토어 멤버 변경 이력을 확인합니다.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[32rem] overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-bg-secondary p-4 sm:flex-row sm:items-end">
            <div className="sm:w-48">
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
                유형 필터
              </label>
              <select
                value={actionFilter}
                onChange={(e) =>
                  setActionFilter(e.target.value as MemberHistoryFilter)
                }
                className="input-field h-10 w-full text-sm"
                disabled={loading}
              >
                <option value="ALL">전체 유형</option>
                <option value="INVITE_SENT">초대</option>
                <option value="ROLE_CHANGED">권한 변경</option>
                <option value="STATUS_CHANGED">상태 변경</option>
                <option value="ROLE_STATUS_CHANGED">권한 + 상태</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
                검색
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="작업자, 대상, 변경 내용 검색"
                className="input-field h-10 w-full text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-border bg-bg-secondary px-4 py-10 text-center text-sm text-text-secondary">
              변경 이력을 불러오는 중입니다.
            </div>
          ) : error ? (
            <div className="rounded-xl border border-danger-500 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-border bg-bg-secondary px-4 py-10 text-center">
              <div className="text-sm font-semibold text-foreground">
                아직 변경 이력이 없습니다.
              </div>
              <div className="mt-1 text-xs text-text-tertiary">
                초대, 권한 변경, 상태 변경 내역이 여기에 표시됩니다.
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-border bg-bg-secondary px-4 py-10 text-center">
              <div className="text-sm font-semibold text-foreground">
                필터 조건에 맞는 이력이 없습니다.
              </div>
              <div className="mt-1 text-xs text-text-tertiary">
                필터를 변경하거나 검색어를 지워보세요.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedItems.map((group) => (
                <div key={group.dateKey} className="space-y-3">
                  <div className="sticky top-0 z-10 -mx-1 rounded-lg bg-background/95 px-1 py-1 text-xs font-bold text-text-secondary backdrop-blur">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-bg-secondary px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex h-6 items-center rounded-full bg-bg-tertiary px-2.5 text-[11px] font-semibold text-text-secondary">
                              {HISTORY_ACTION_LABEL[item.actionType]}
                            </span>
                            <span className="text-xs text-text-tertiary">
                              {item.scopeType === 'BRANCH'
                                ? '스토어 권한'
                                : '브랜드 권한'}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-foreground">
                            {getHistoryMessage(item)}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-text-tertiary">
                          {formatHistoryDate(item.createdAt)}
                        </div>
                      </div>
                      {(item.beforeRole ||
                        item.beforeStatus ||
                        item.afterRole ||
                        item.afterStatus) && (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-border/80 bg-background px-3 py-2">
                            <div className="text-[11px] font-semibold text-text-secondary">
                              이전 값
                            </div>
                            <div className="mt-1 text-xs text-text-tertiary">
                              역할:{' '}
                              {item.beforeRole
                                ? getRoleLabelByRawRole(
                                    item.beforeRole as InviteRole,
                                  )
                                : '-'}
                            </div>
                            <div className="mt-0.5 text-xs text-text-tertiary">
                              상태:{' '}
                              {item.beforeStatus
                                ? item.beforeStatus === 'SUSPENDED'
                                  ? '비활성화'
                                  : STATUS_LABEL[mapStatus(item.beforeStatus)]
                                : '-'}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border/80 bg-background px-3 py-2">
                            <div className="text-[11px] font-semibold text-text-secondary">
                              변경 후
                            </div>
                            <div className="mt-1 text-xs text-text-tertiary">
                              역할:{' '}
                              {item.afterRole
                                ? getRoleLabelByRawRole(
                                    item.afterRole as InviteRole,
                                  )
                                : '-'}
                            </div>
                            <div className="mt-0.5 text-xs text-text-tertiary">
                              상태:{' '}
                              {item.afterStatus
                                ? item.afterStatus === 'SUSPENDED'
                                  ? '비활성화'
                                  : STATUS_LABEL[mapStatus(item.afterStatus)]
                                : '-'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
