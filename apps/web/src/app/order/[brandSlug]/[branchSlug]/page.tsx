import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OrderPageClient from "./OrderPageClient";
import type { ProductCardProduct } from "@/components/ui/ProductCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");

type PageProps = {
  params: Promise<{ brandSlug: string; branchSlug: string }>;
};

type PublicProductResponse = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  sortOrder?: number | null;
  sort_order?: number | null;
  discountPrice?: number | null;
  urgentDiscountEndAt?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  image_url?: string | null;
  image_urls?: string[] | null;
  categoryId?: string | null;
  category_id?: string | null;
  badges?: ProductCardProduct["badges"];
  stock?: ProductCardProduct["stock"];
  options?: ProductCardProduct["options"];
};

type PublicBranchResponse = {
  id: string;
  name: string;
  brandName?: string;
  billingTier?: 'PG' | 'NON_PG' | null;
  cashReceiptEnabled?: boolean | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  contactPhone?: string | null;
  kakaoChannelUrl?: string | null;
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
  orderNotice?: string | null;
};

async function fetchBranch(
  brandSlug: string,
  branchSlug: string,
): Promise<PublicBranchResponse | null> {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  const primaryResponse = await fetch(
    `${API_BASE}/public/brands/${encodeURIComponent(brandSlug)}/branches/${encodeURIComponent(branchSlug)}`,
    { next: { revalidate: 30 } },
  );

  if (primaryResponse.ok) {
    return (await primaryResponse.json()) as PublicBranchResponse;
  }

  if (primaryResponse.status !== 404) {
    // Upstream API failure should not crash the whole page with 500.
    // Fallback endpoint is attempted below, and if that also fails we return null.
  }

  // Keep existing order URLs working even if the brand slug changes later.
  const fallbackResponse = await fetch(
    `${API_BASE}/public/branches/slug/${encodeURIComponent(branchSlug)}`,
    { next: { revalidate: 30 } },
  );

  if (!fallbackResponse.ok) {
    return null;
  }

  return (await fallbackResponse.json()) as PublicBranchResponse;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { brandSlug, branchSlug } = await params;

  try {
    const branch = await fetchBranch(brandSlug, branchSlug);

    if (!branch) {
      return {
        title: "주문하기",
      };
    }

    return {
      title: branch.name,
      description: `${branch.name} 온라인 주문 링크`,
    };
  } catch {
    return {
      title: "주문하기",
    };
  }
}

export default async function OrderPage({ params }: PageProps) {
  const { brandSlug, branchSlug } = await params;

  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  let branch: PublicBranchResponse | null = null;
  try {
    branch = await fetchBranch(brandSlug, branchSlug);
  } catch {
    branch = null;
  }
  if (!branch) {
    notFound();
  }

  const branchId = String(branch.id);

  const [productsRes, catsRes] = await Promise.all([
    fetch(
      `${API_BASE}/public/branches/${encodeURIComponent(branchId)}/products`,
      { next: { revalidate: 30 } },
    ),
    fetch(
      `${API_BASE}/public/branches/${encodeURIComponent(branchId)}/categories`,
      { next: { revalidate: 30 } },
    ),
  ]);

  const productsData: PublicProductResponse[] = productsRes.ok
    ? await productsRes.json()
    : [];

  const products: ProductCardProduct[] = productsData.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    sortOrder: p.sortOrder ?? p.sort_order ?? null,
    discountPrice: p.discountPrice ?? undefined,
    urgentDiscountEndAt: p.urgentDiscountEndAt ?? undefined,
    imageUrl: p.imageUrl || p.image_url || null,
    imageUrls: Array.isArray(p.imageUrls)
      ? p.imageUrls
      : Array.isArray(p.image_urls)
        ? p.image_urls
        : undefined,
    categoryId: p.categoryId ?? p.category_id ?? null,
    badges: p.badges,
    stock: p.stock,
    options: p.options,
  }));

  const categories = catsRes.ok ? await catsRes.json() : [];

  return (
    <OrderPageClient
      branch={branch}
      products={products}
      categories={categories}
      brandSlug={brandSlug}
      branchSlug={branchSlug}
    />
  );
}
