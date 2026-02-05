import { SupabaseService } from '../../infra/supabase/supabase.service';
import { InventoryService } from '../inventory/inventory.service';
import { PublicBranchResponse, PublicProductResponse, PublicOrderResponse, CreatePublicOrderRequest } from './dto/public-order.dto';
export declare class PublicOrderService {
    private readonly supabase;
    private readonly inventoryService;
    private readonly logger;
    constructor(supabase: SupabaseService, inventoryService: InventoryService);
    private getPriceFromRow;
    getBranch(branchId: string): Promise<PublicBranchResponse>;
    getBranchBySlug(slug: string): Promise<PublicBranchResponse>;
    getBranchByBrandSlug(brandSlug: string, branchSlug: string): Promise<PublicBranchResponse>;
    getProducts(branchId: string): Promise<PublicProductResponse[]>;
    createOrder(dto: CreatePublicOrderRequest): Promise<PublicOrderResponse>;
    getOrder(orderIdOrNo: string): Promise<PublicOrderResponse>;
}
