export declare class PublicBranchResponse {
    id: string;
    name: string;
    brandName?: string;
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
    options: PublicProductOptionResponse[];
}
export declare class PublicOrderResponse {
    id: string;
    orderNo: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    items: {
        name: string;
        qty: number;
        unitPrice: number;
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
export declare class CreatePublicOrderRequest {
    branchId: string;
    customerName: string;
    customerPhone?: string;
    customerAddress1?: string;
    customerAddress2?: string;
    customerMemo?: string;
    paymentMethod?: 'CARD' | 'TRANSFER' | 'CASH';
    items: OrderItemDto[];
}
