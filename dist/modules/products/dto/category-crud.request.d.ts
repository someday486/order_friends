export declare class CreateCategoryRequest {
    branchId: string;
    name: string;
    sortOrder?: number;
    isActive?: boolean;
}
export declare class UpdateCategoryRequest {
    name?: string;
    sortOrder?: number;
    isActive?: boolean;
}
export declare class ReorderCategoryItem {
    id: string;
    sortOrder: number;
}
export declare class ReorderCategoriesRequest {
    branchId: string;
    items: ReorderCategoryItem[];
}
