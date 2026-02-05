export declare class InventoryListResponse {
    id: string;
    product_id: string;
    product_name: string;
    branch_id: string;
    qty_available: number;
    qty_reserved: number;
    qty_sold: number;
    low_stock_threshold: number;
    is_low_stock: boolean;
    total_quantity?: number;
    image_url?: string;
    category?: string;
    created_at: string;
    updated_at: string;
}
export declare class InventoryAlertResponse {
    product_id: string;
    product_name: string;
    branch_id: string;
    branch_name: string;
    qty_available: number;
    low_stock_threshold: number;
    image_url?: string;
}
export declare class InventoryLogResponse {
    id: string;
    product_id: string;
    branch_id: string;
    transaction_type: string;
    qty_change: number;
    qty_before: number;
    qty_after: number;
    reference_id?: string;
    reference_type?: string;
    notes?: string;
    created_by?: string;
    created_at: string;
}
export declare class InventoryDetailResponse extends InventoryListResponse {
    product?: {
        id: string;
        name: string;
        description?: string;
        price: number;
        image_url?: string;
        category?: string;
    };
}
export declare class UpdateInventoryRequest {
    qty_available?: number;
    low_stock_threshold?: number;
}
export declare enum TransactionType {
    RESTOCK = "RESTOCK",
    SALE = "SALE",
    RESERVE = "RESERVE",
    RELEASE = "RELEASE",
    ADJUSTMENT = "ADJUSTMENT",
    DAMAGE = "DAMAGE",
    RETURN = "RETURN"
}
export declare class AdjustInventoryRequest {
    qty_change: number;
    transaction_type: TransactionType;
    notes?: string;
}
