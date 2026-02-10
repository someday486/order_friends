import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { PublicBranchResponse, PublicProductResponse, PublicOrderResponse, CreatePublicOrderRequest } from './dto/public-order.dto';
export declare class PublicOrderService {
    private readonly supabase;
    private readonly inventoryService;
    private readonly logger;
    private readonly duplicateWindowMs;
    private readonly weakDuplicateWindowMs;
    private readonly duplicateLookbackLimit;
    constructor(supabase: SupabaseService, inventoryService: InventoryService);
    private getPriceFromRow;
    private rollbackOrder;
    getBranch(branchId: string): Promise<PublicBranchResponse>;
    getBranchBySlug(slug: string): Promise<PublicBranchResponse>;
    getBranchByBrandSlug(brandSlug: string, branchSlug: string): Promise<PublicBranchResponse>;
    getProducts(branchId: string): Promise<PublicProductResponse[]>;
    private buildOrderSignature;
    private normalizeOptional;
    private getDuplicatePolicy;
    private buildSignatureFromOrder;
    private buildOrderResponse;
    private fetchOrderByIdempotencyKey;
    private logDedupEvent;
    private logMetric;
    private findRecentDuplicateOrder;
    createOrder(dto: CreatePublicOrderRequest): Promise<PublicOrderResponse>;
    getOrder(orderIdOrNo: string): Promise<PublicOrderResponse>;
    getCategories(branchId: string): Promise<{
        id: any;
        name: any;
        sortOrder: any;
    }[]>;
}
