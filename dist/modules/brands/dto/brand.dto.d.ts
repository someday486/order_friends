export declare class BrandListItemResponse {
    id: string;
    name: string;
    slug?: string | null;
    bizName?: string | null;
    bizRegNo?: string | null;
    createdAt: string;
}
export declare class BrandDetailResponse {
    id: string;
    name: string;
    slug?: string | null;
    ownerUserId?: string | null;
    bizName?: string | null;
    bizRegNo?: string | null;
    createdAt: string;
}
export declare class CreateBrandRequest {
    name: string;
    slug?: string;
    bizName?: string;
    bizRegNo?: string;
}
export declare class UpdateBrandRequest {
    name?: string;
    slug?: string;
    bizName?: string;
    bizRegNo?: string;
}
