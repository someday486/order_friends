export class ProductListItemResponse {
  id: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  price: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}
