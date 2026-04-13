'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedBrand } from '@/hooks/useSelectedBrand';

type DashboardStats = {
  totalOrders: number;
  pendingOrders: number;
  todayOrders: number;
  totalProducts: number;
  totalBranches: number;
};

export default function AdminHomePage() {
  const { brandId, ready } = useSelectedBrand();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!brandId) {
      setStats(null);
      setLoading(false);
      return;
    }

    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<DashboardStats>(
          `/admin/dashboard/stats?brandId=${encodeURIComponent(brandId)}`,
        );
        setStats({
          totalOrders: data.totalOrders ?? 0,
          pendingOrders: data.pendingOrders ?? 0,
          todayOrders: data.todayOrders ?? 0,
          totalProducts: data.totalProducts ?? 0,
          totalBranches: data.totalBranches ?? 0,
        });
      } catch (e) {
        console.error(e);
        setStats({
          totalOrders: 0,
          pendingOrders: 0,
          todayOrders: 0,
          totalProducts: 0,
          totalBranches: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    void loadStats();
  }, [brandId, ready]);

  return (
    <div>
      {!brandId && (
        <div className="mb-4 p-3 border border-border rounded-lg">
          <p className="text-text-secondary text-[13px] m-0">
            브랜드를 선택하면 대시보드 통계가 표시됩니다.
          </p>
          <Link href="/admin/brand" className="text-foreground text-[13px]">
            브랜드 선택하러 가기
          </Link>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-extrabold m-0 text-foreground">
          안녕하세요{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
        </h1>
        <p className="text-text-secondary mt-2 text-sm">
          오더프렌즈 관리자 대시보드입니다.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-8">
        <StatCard
          title="전체 주문"
          value={stats?.totalOrders ?? '-'}
          loading={loading}
        />
        <StatCard
          title="처리 대기"
          value={stats?.pendingOrders ?? '-'}
          loading={loading}
          highlight
        />
        <StatCard
          title="오늘 주문"
          value={stats?.todayOrders ?? '-'}
          loading={loading}
        />
        <StatCard
          title="등록 상품"
          value={stats?.totalProducts ?? '-'}
          loading={loading}
        />
      </div>

      <div className="mb-8">
        <h2 className="text-base font-bold mb-4 text-foreground">빠른 이동</h2>
        <div className="flex gap-3 flex-wrap">
          <QuickLinkCard
            href="/admin/orders"
            title="주문 관리"
            description="주문 목록 조회와 처리를 진행합니다."
          />
          <QuickLinkCard
            href="/admin/products"
            title="상품 관리"
            description="상품 등록과 수정을 진행합니다."
          />
          <QuickLinkCard
            href="/admin/stores"
            title="매장 관리"
            description="브랜드별 매장을 추가하고 관리합니다."
          />
          <QuickLinkCard
            href="/admin/brand"
            title="브랜드 관리"
            description="브랜드 정보와 설정을 관리합니다."
          />
          <QuickLinkCard
            href="/admin/members"
            title="권한 관리"
            description="시스템 관리자 권한과 멤버 권한을 확인합니다."
          />
        </div>
      </div>

      <div className="card p-4">
        <div className="font-semibold mb-2 text-foreground">빠른 시작하기</div>
        <ol className="m-0 pl-5 text-text-secondary text-[13px] leading-[1.8]">
          <li>브랜드 관리에서 운영할 브랜드를 선택하거나 확인해 주세요.</li>
          <li>매장 관리에서 브랜드에 속한 매장을 등록해 주세요.</li>
          <li>권한 관리에서 운영할 멤버 권한을 확인해 주세요.</li>
          <li>상품 관리에서 매장별 상품을 등록해 주세요.</li>
          <li>주문이 들어오면 주문 관리에서 상태를 처리해 주세요.</li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  loading,
  highlight,
}: {
  title: string;
  value: number | string;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-5 rounded-xl border ${
        highlight
          ? 'border-border bg-bg-tertiary'
          : 'border-border bg-bg-secondary'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-text-secondary text-[13px]">{title}</span>
      </div>
      <div className="text-[28px] font-extrabold text-foreground">
        {loading ? <span className="text-text-tertiary">...</span> : value}
      </div>
    </div>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 py-3 px-3.5 rounded-lg border border-border bg-bg-secondary text-foreground no-underline hover:bg-bg-tertiary transition-colors"
    >
      <div>
        <div className="font-bold mb-0.5">{title}</div>
        <div className="text-xs text-text-secondary">{description}</div>
      </div>
    </Link>
  );
}
