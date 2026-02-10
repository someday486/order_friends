import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { PublicBranchResponse, PublicProductResponse, PublicOrderResponse, CreatePublicOrderRequest } from './dto/public-order.dto';
export declare class PublicOrderService {
    private readonly supabase;
    private readonly inventoryService;
    private readonly logger;
    private readonly duplicateWindowMs;
    constructor(supabase: SupabaseService, inventoryService: InventoryService);
    private getPriceFromRow;
    private rollbackOrder;
    private rollbackInventory;
    getBranch(branchId: string): Promise<PublicBranchResponse>;
    getBranchBySlug(slug: string): Promise<PublicBranchResponse>;
    getBranchByBrandSlug(brandSlug: string, branchSlug: string): Promise<PublicBranchResponse>;
    getProducts(branchId: string): Promise<PublicProductResponse[]>;
    private buildOrderSignature;
    private findRecentDuplicateOrder;
    createOrder(dto: CreatePublicOrderRequest): Promise<PublicOrderResponse>;
    getOrder(orderIdOrNo: string): Promise<PublicOrderResponse>;
    getCategories(branchId: string): Promise<{
        id: any;
        name: any;
        sortOrder: any;
    }[]>;
}
