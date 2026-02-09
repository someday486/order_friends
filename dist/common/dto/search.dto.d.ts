export declare class SearchDto {
    q?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}
export declare class ProductSearchDto extends SearchDto {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    brandId?: string;
}
export declare class OrderSearchDto extends SearchDto {
    status?: string;
    startDate?: string;
    endDate?: string;
    customerName?: string;
    minAmount?: number;
    maxAmount?: number;
}
