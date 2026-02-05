import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership, BranchMembership } from '../../common/types/auth-request';
import { CreateProductRequest } from '../../modules/products/dto/create-product.request';
import { UpdateProductRequest } from '../../modules/products/dto/update-product.request';
export declare class CustomerProductsService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    private checkBranchAccess;
    private checkProductAccess;
    private checkModificationPermission;
    getMyProducts(userId: string, branchId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        branch_id: any;
        name: any;
        description: any;
        category_id: any;
        price: any;
        is_active: any;
        sort_order: any;
        image_url: any;
        created_at: any;
    }[]>;
    getMyProduct(userId: string, productId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<any>;
    createMyProduct(userId: string, dto: CreateProductRequest, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<any>;
    updateMyProduct(userId: string, productId: string, dto: UpdateProductRequest, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<any>;
    deleteMyProduct(userId: string, productId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        deleted: boolean;
    }>;
}
