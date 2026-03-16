import { notFound } from "next/navigation";
import ShopBrandPageClient, { type ShopBrandResponse } from "./ShopBrandPageClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

export default async function ShopBrandPage({
  params,
}: {
  params: Promise<{ brandSlug: string }>;
}) {
  const { brandSlug } = await params;

  let initialData: ShopBrandResponse | null = null;

  if (API_BASE) {
    try {
      const res = await fetch(
        `${API_BASE}/public/shop/brands/${encodeURIComponent(brandSlug)}`,
        { next: { revalidate: 30 } },
      );
      if (res.status === 404) notFound();
      if (res.ok) initialData = (await res.json()) as ShopBrandResponse;
    } catch {
      // 네트워크 오류 시 클라이언트 폴백으로 렌더링
    }
  }

  return <ShopBrandPageClient brandSlug={brandSlug} initialData={initialData} />;
}
