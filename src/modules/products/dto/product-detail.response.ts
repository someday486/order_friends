export class ProductOptionResponse {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
  sortOrder: number;
}

export class ProductDetailResponse {
  id: string;
  branchId: string;
  name: string;
  categoryId?: string | null;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  options: ProductOptionResponse[];
}
