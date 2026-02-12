export declare class BrandListItemResponse {
    id: string;
    name: string;
    slug?: string | null;
    bizName?: string | null;
    bizRegNo?: string | null;
    logoUrl?: string | null;
    createdAt: string;
}
export declare class BrandDetailResponse {
    id: string;
    name: string;
    slug?: string | null;
    ownerUserId?: string | null;
    bizName?: string | null;
    bizRegNo?: string | null;
    repName?: string | null;
    address?: string | null;
    bizCertUrl?: string | null;
    logoUrl?: string | null;
    coverImageUrl?: string | null;
    createdAt: string;
}
export declare class CreateBrandRequest {
    name: string;
    slug?: string;
    bizName?: string;
    bizRegNo?: string;
    repName?: string;
    address?: string;
    bizCertUrl?: string;
    logoUrl?: string;
    coverImageUrl?: string;
}
export declare class UpdateBrandRequest {
    name?: string;
    slug?: string;
    bizName?: string;
    bizRegNo?: string;
    repName?: string;
    address?: string;
    bizCertUrl?: string;
    logoUrl?: string;
    coverImageUrl?: string;
}
