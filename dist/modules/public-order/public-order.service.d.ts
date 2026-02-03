import { SupabaseService } from '../../infra/supabase/supabase.service';
import { PublicBranchResponse, PublicProductResponse, PublicOrderResponse, CreatePublicOrderRequest } from './dto/public-order.dto';
export declare class PublicOrderService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    private getPriceFromRow;
    getBranch(branchId: string): Promise<PublicBranchResponse>;
    getProducts(branchId: string): Promise<PublicProductResponse[]>;
    createOrder(dto: CreatePublicOrderRequest): Promise<PublicOrderResponse>;
    getOrder(orderIdOrNo: string): Promise<PublicOrderResponse>;
}
