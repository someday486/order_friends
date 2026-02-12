import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BrandListItemResponse, BrandDetailResponse, CreateBrandRequest, UpdateBrandRequest } from './dto/brand.dto';
export declare class BrandsService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    private getClient;
    getMyBrands(accessToken: string, isAdmin?: boolean): Promise<BrandListItemResponse[]>;
    getBrand(accessToken: string, brandId: string, isAdmin?: boolean): Promise<BrandDetailResponse>;
    createBrand(accessToken: string, dto: CreateBrandRequest, _isAdmin?: boolean): Promise<BrandDetailResponse>;
    updateBrand(accessToken: string, brandId: string, dto: UpdateBrandRequest, isAdmin?: boolean): Promise<BrandDetailResponse>;
    deleteBrand(accessToken: string, brandId: string, isAdmin?: boolean): Promise<{
        deleted: boolean;
    }>;
}
