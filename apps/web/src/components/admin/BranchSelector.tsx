'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSelectedBrand } from '@/hooks/useSelectedBrand';
import { useSelectedBranch } from '@/hooks/useSelectedBranch';
import { getAdminBranches } from '@/lib/adminDataCache';

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug?: string | null;
  createdAt: string;
};

type BranchSelectorProps = {
  label?: string;
  compact?: boolean;
  showInlineLabel?: boolean;
  showManageLink?: boolean;
  placeholder?: string;
};

export default function BranchSelector({
  label = '스토어 선택',
  compact = false,
  showInlineLabel = true,
  showManageLink = true,
  placeholder = '스토어를 선택하세요',
}: BranchSelectorProps) {
  const { brandId, ready } = useSelectedBrand();
  const { branchId, selectBranch } = useSelectedBranch();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => branchId ?? '', [branchId]);

  useEffect(() => {
    if (!ready) return;

    if (!brandId) {
      setBranches([]);
      setLoading(false);
      return;
    }

    const fetchBranches = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getAdminBranches(brandId);
        setBranches(data);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? '스토어 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    void fetchBranches();
  }, [ready, brandId]);

  if (!ready) return null;

  if (!brandId) {
    return (
      <div className="flex items-center gap-3 rounded border border-border bg-bg-secondary p-2.5">
        <div className="text-xs text-text-secondary">브랜드가 아직 선택되지 않았습니다.</div>
        <Link href="/admin/brand" className="text-sm text-foreground">
          브랜드 선택하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showInlineLabel ? <label className="text-xs text-text-secondary">{label}:</label> : null}
      <select
        value={selected}
        onChange={(e) => selectBranch(e.target.value)}
        className={`rounded border border-border bg-bg-secondary text-foreground text-xs ${
          compact ? 'h-[30px] rounded-sm px-2' : 'h-[34px] min-w-[200px] px-2.5'
        }`}
      >
        <option value="">{placeholder}</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>

      {showManageLink ? (
        <Link
          href="/admin/stores"
          className="text-xs text-text-secondary transition-colors hover:text-foreground"
        >
          가게 관리
        </Link>
      ) : null}

      {loading ? <span className="text-xs text-text-tertiary">불러오는 중...</span> : null}
      {error ? <span className="text-xs text-danger-500">{error}</span> : null}
    </div>
  );
}
