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
  description?: string | null;
  price: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  options: ProductOptionResponse[];
}
