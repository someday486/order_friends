'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useSelectedBrand } from '@/hooks/useSelectedBrand';
import { useSelectedBranch } from '@/hooks/useSelectedBranch';

type Branch = {
  id: string;
  brandId: string;
  name: string;
  slug?: string;
  createdAt: string;
};

export default function BranchSelector({
  label = '가게 선택',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const { brandId, ready } = useSelectedBrand();
  const { branchId, selectBranch } = useSelectedBranch();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => branchId ?? '', [branchId]);

  useEffect(() => {
    if (!ready || !brandId) {
      return;
    }

    const fetchBranches = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiClient.get<Branch[]>(
          `/admin/branches?brandId=${encodeURIComponent(brandId)}`,
        );
        setBranches(data);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message ?? '조회 실패');
      } finally {
        setLoading(false);
      }
    };

    void fetchBranches();
  }, [ready, brandId]);

  if (!ready) return null;

  if (!brandId) {
    return (
      <div className="p-2.5 border border-border rounded bg-bg-secondary flex items-center gap-3">
        <div className="text-xs text-text-secondary">
          브랜드가 선택되어 있지 않습니다.
        </div>
        <Link href="/admin/brand" className="text-foreground text-sm">
          브랜드 선택하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-text-secondary text-xs">{label}:</label>
      <select
        value={selected}
        onChange={(e) => selectBranch(e.target.value)}
        className={`
          rounded border border-border bg-bg-secondary text-foreground text-xs
          ${compact ? 'h-[30px] px-2 rounded-sm' : 'h-[34px] px-2.5 min-w-[200px]'}
        `}
      >
        <option value="">가게를 선택하세요</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>

      <Link
        href="/admin/stores"
        className="text-text-secondary text-xs hover:text-foreground transition-colors"
      >
        가게 관리
      </Link>

      {loading && (
        <span className="text-text-tertiary text-xs">불러오는 중...</span>
      )}
      {error && <span className="text-danger-500 text-xs">{error}</span>}
    </div>
  );
}
