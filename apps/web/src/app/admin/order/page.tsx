"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import OrderLauncher from "@/components/order/OrderLauncher";

type Brand = {
  id: string;
  name: string;
  slug: string | null;
};

type Branch = {
  id: string;
  name: string;
  slug: string | null;
  brandId: string;
};

export default function AdminOrderLauncherPage() {
  const [sections, setSections] = useState<{ brand: Brand; branches: Branch[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const brands = await apiClient.get<Brand[]>("/admin/brands");
        const branchesByBrand: Record<string, Branch[]> = {};

        const branchLists = await Promise.all(
          brands.map(async (brand) => {
            const branches = await apiClient.get<Branch[]>(
              `/admin/branches?brandId=${encodeURIComponent(brand.id)}`,
            );
            return { brandId: brand.id, branches };
          }),
        );

        for (const item of branchLists) {
          branchesByBrand[item.brandId] = item.branches;
        }

        setSections(
          brands.map((brand) => ({
            brand: {
              id: brand.id,
              name: brand.name,
              slug: brand.slug ?? null,
            },
            branches: branchesByBrand[brand.id] ?? [],
          })),
        );
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <OrderLauncher
      title="브랜드 주문 선택"
      description="원하는 브랜드와 매장을 선택해 주문 페이지로 이동하세요."
      sections={sections}
      loading={loading}
      error={error}
      isEmptyText="현재 등록된 매장이 없습니다."
    />
  );
}
