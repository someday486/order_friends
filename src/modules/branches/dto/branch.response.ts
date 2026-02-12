export class BranchListItemResponse {
  id: string;
  brandId: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
}

export class BranchDetailResponse {
  id: string;
  brandId: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
}
