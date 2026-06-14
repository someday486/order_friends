'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PublicAuthActions } from '@/components/auth/PublicAuthActions';

type PublicBrandBranch = {
  id: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
};

type PublicBrandBranchesResponse = {
  brandSlug: string;
  brandName?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  branches: PublicBrandBranch[];
};

function getBranchOrderPath(
  brandSlug: string,
  branch: PublicBrandBranch,
): string {
  if (branch.slug) {
    return `/order/${encodeURIComponent(brandSlug)}/${encodeURIComponent(branch.slug)}`;
  }

  return `/order/branch/${branch.id}`;
}

export default function BrandOrderPage() {
  const params = useParams();
  const brandSlug = params?.brandSlug as string;

  const [data, setData] = useState<PublicBrandBranchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandSlug) return;

    const fetchBranches = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.get<PublicBrandBranchesResponse>(
          `/public/brands/${encodeURIComponent(brandSlug)}/branches`,
          { auth: false },
        );

        setData(response);
      } catch {
        setError('브랜드 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    void fetchBranches();
  }, [brandSlug]);

  const resolvedBrandSlug = data?.brandSlug || brandSlug;
  const brandName = data?.brandName || resolvedBrandSlug;
  const branches = data?.branches ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-lg mx-auto p-6">
          <div
            className="card p-6 text-center text-text-secondary"
            data-testid="branch-selector-loading"
          >
            스토어 정보를 불러오는 중입니다.
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-lg mx-auto p-6">
          <div
            className="card p-6 text-center"
            data-testid="branch-selector-error"
          >
            <div className="text-base font-semibold text-foreground mb-1">
              브랜드를 찾을 수 없습니다.
            </div>
            <p className="text-sm text-text-secondary">
              {error ?? '다시 시도해 주세요.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 z-30 bg-background border-b border-border">
          {data.coverImageUrl && (
            <div className="relative z-0 h-32 -mb-4 overflow-hidden">
              <Image
                src={data.coverImageUrl}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>
          )}

          <div className="relative z-10 px-4 py-4 flex items-center gap-3">
            {data.logoUrl ? (
              <Image
                src={data.logoUrl}
                alt={brandName}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover border border-border"
                unoptimized
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-bg-tertiary flex items-center justify-center text-lg">
                B
              </div>
            )}

            <div>
              <div className="text-2xs text-text-tertiary">브랜드 주문</div>
              <h1 className="text-lg font-bold text-foreground leading-tight">
                {brandName}
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                주문할 스토어를 선택해 주세요.
              </p>
            </div>
          </div>
          <div className="px-4 pb-4">
            <PublicAuthActions />
          </div>
        </header>

        <main className="p-4 pb-8">
          {branches.length === 0 ? (
            <div
              className="card p-6 text-center"
              data-testid="branch-selector-empty"
            >
              <div className="text-base font-semibold text-foreground mb-1">
                주문 가능한 스토어가 없습니다.
              </div>
              <p className="text-sm text-text-secondary">
                잠시 후 다시 시도하거나 관리자에게 문의해 주세요.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {branches.map((branch) => (
                <Link
                  key={branch.id}
                  href={getBranchOrderPath(resolvedBrandSlug, branch)}
                  className="no-underline"
                  data-testid={`branch-card-${branch.id}`}
                >
                  <div className="card p-4 flex items-center justify-between gap-3 hover:bg-bg-tertiary transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {branch.logoUrl ? (
                        <Image
                          src={branch.logoUrl}
                          alt={branch.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full object-cover border border-border"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-base">
                          S
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">
                          {branch.name}
                        </div>
                        <div className="text-xs text-text-tertiary truncate">
                          {getBranchOrderPath(resolvedBrandSlug, branch)}
                        </div>
                      </div>
                    </div>
                    <div className="text-text-secondary text-xs">선택</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
