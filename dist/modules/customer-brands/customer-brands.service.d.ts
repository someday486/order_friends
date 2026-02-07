import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership } from '../../common/types/auth-request';
export declare class CustomerBrandsService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    getMyBrands(userId: string, brandMemberships: BrandMembership[]): Promise<{
        myRole: string | null;
        id: any;
        name: any;
        biz_name: any;
        biz_reg_no: any;
        owner_user_id: any;
        logo_url: any;
        cover_image_url: any;
        thumbnail_url: any;
        created_at: any;
    }[]>;
    getMyBrand(brandId: string, userId: string, brandMemberships: BrandMembership[]): Promise<{
        myRole: string;
        id: any;
        name: any;
        biz_name: any;
        biz_reg_no: any;
        owner_user_id: any;
        logo_url: any;
        cover_image_url: any;
        thumbnail_url: any;
        created_at: any;
    }>;
    updateMyBrand(brandId: string, updateData: any, userId: string, brandMemberships: BrandMembership[]): Promise<any>;
}
