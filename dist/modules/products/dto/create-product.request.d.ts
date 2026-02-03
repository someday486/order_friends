export declare class CreateProductOptionDto {
    name: string;
    priceDelta?: number;
    isActive?: boolean;
    sortOrder?: number;
}
export declare class CreateProductRequest {
    branchId: string;
    name: string;
    description?: string;
    price: number;
    isActive?: boolean;
    sortOrder?: number;
    options?: CreateProductOptionDto[];
}
