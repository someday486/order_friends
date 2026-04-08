import ShopPageClient, { type PublicBrandItem } from './ShopPageClient';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '');

async function getInitialBrands(): Promise<PublicBrandItem[] | null> {
  if (!API_BASE) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/public/brands`, {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as PublicBrandItem[];
    return Array.isArray(data) ? data : [];
  } catch {
    return null;
  }
}

export default async function ShopPage() {
  const initialBrands = await getInitialBrands();

  return <ShopPageClient initialBrands={initialBrands} />;
}
