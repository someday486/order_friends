import { notFound } from "next/navigation";
import OrderPageClient from "./OrderPageClient";
import type { ProductCardProduct } from "@/components/ui/ProductCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

type PageProps = {
  params: Promise<{ brandSlug: string; branchSlug: string }>;
};

export default async function OrderPage({ params }: PageProps) {
  const { brandSlug, branchSlug } = await params;

  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  // Fetch branch info (server-side)
  const branchRes = await fetch(
    `${API_BASE}/public/brands/${encodeURIComponent(brandSlug)}/branches/${encodeURIComponent(branchSlug)}`,
    { cache: "no-store" },
  );

  if (!branchRes.ok) {
    notFound();
  }

  const branch = await branchRes.json();

  // Fetch products (server-side)
  const productsRes = await fetch(
    `${API_BASE}/public/branches/${encodeURIComponent(branch.id)}/products`,
    { cache: "no-store" },
  );

  const productsData = productsRes.ok ? await productsRes.json() : [];

  const products: ProductCardProduct[] = productsData.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    discountPrice: p.discountPrice,
    imageUrl: p.imageUrl || p.image_url || null,
    categoryId: p.categoryId ?? p.category_id ?? null,
    badges: p.badges,
    stock: p.stock,
    options: p.options,
  }));

  // Fetch categories (server-side)
  const catsRes = await fetch(
    `${API_BASE}/public/branches/${encodeURIComponent(branch.id)}/categories`,
    { cache: "no-store" },
  );

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
