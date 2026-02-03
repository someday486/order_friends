export declare class BrandListItemResponse {
    id: string;
    name: string;
    bizName?: string | null;
    bizRegNo?: string | null;
    createdAt: string;
}
export declare class BrandDetailResponse {
    id: string;
    name: string;
    ownerUserId?: string | null;
    bizName?: string | null;
    bizRegNo?: string | null;
    createdAt: string;
}
export declare class CreateBrandRequest {
    name: string;
    bizName?: string;
    bizRegNo?: string;
}
export declare class UpdateBrandRequest {
    name?: string;
    bizName?: string;
    bizRegNo?: string;
}
