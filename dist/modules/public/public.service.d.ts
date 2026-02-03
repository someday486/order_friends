import { SupabaseService } from '../../infra/supabase/supabase.service';
import { PublicBranchResponse, PublicProductResponse, PublicOrderResponse, CreatePublicOrderRequest } from './dto/public.dto';
export declare class PublicService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    getBranch(branchId: string): Promise<PublicBranchResponse>;
    getProducts(branchId: string): Promise<PublicProductResponse[]>;
    createOrder(dto: CreatePublicOrderRequest): Promise<PublicOrderResponse>;
    getOrder(orderId: string): Promise<PublicOrderResponse>;
}
