export declare class PublicBranchResponse {
    id: string;
    name: string;
    brandName?: string;
    logoUrl?: string | null;
    coverImageUrl?: string | null;
}
export declare class PublicProductOptionResponse {
    id: string;
    name: string;
    priceDelta: number;
}
export declare class PublicProductResponse {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    imageUrl?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    sortOrder?: number;
    options: PublicProductOptionResponse[];
}
export declare class PublicCategoryResponse {
    id: string;
    name: string;
    sortOrder: number;
}
export declare class PublicOrderResponse {
    id: string;
    orderNo: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    items: {
        productName: string;
        qty: number;
        unitPrice: number;
        options: string[];
    }[];
}
export declare class OrderItemOptionDto {
    optionId: string;
}
export declare class OrderItemDto {
    productId: string;
    qty: number;
    options?: OrderItemOptionDto[];
}
export declare enum PaymentMethod {
    CARD = "CARD",
    TRANSFER = "TRANSFER",
    CASH = "CASH"
}
export declare class CreatePublicOrderRequest {
    branchId: string;
    idempotencyKey?: string;
    customerName: string;
    customerPhone?: string;
    customerAddress1?: string;
    customerAddress2?: string;
    customerMemo?: string;
    paymentMethod?: PaymentMethod;
    items: OrderItemDto[];
}
