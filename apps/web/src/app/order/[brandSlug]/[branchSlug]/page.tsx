import { notFound } from "next/navigation";
import OrderPageClient from "./OrderPageClient";
import type { ProductCardProduct } from "@/components/ui/ProductCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type PageProps = {
  params: Promise<{ brandSlug: string; branchSlug: string }>;
};

type PublicProductResponse = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  imageUrl?: string | null;
  image_url?: string | null;
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
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  enabledFulfillmentTypes?: string[] | null;
  allowedPaymentMethods?: string[] | null;
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
    throw new Error(`Failed to load branch: ${primaryResponse.status}`);
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

export default async function OrderPage({ params }: PageProps) {
  const { brandSlug, branchSlug } = await params;

  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  const branch = await fetchBranch(brandSlug, branchSlug);
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
    discountPrice: p.discountPrice ?? undefined,
    imageUrl: p.imageUrl || p.image_url || null,
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
