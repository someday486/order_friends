import { SupabaseService } from '../../infra/supabase/supabase.service';
import { BrandListItemResponse, BrandDetailResponse, CreateBrandRequest, UpdateBrandRequest } from './dto/brand.dto';
export declare class BrandsService {
    private readonly supabase;
    constructor(supabase: SupabaseService);
    getMyBrands(accessToken: string): Promise<BrandListItemResponse[]>;
    getBrand(accessToken: string, brandId: string): Promise<BrandDetailResponse>;
    createBrand(accessToken: string, dto: CreateBrandRequest): Promise<BrandDetailResponse>;
    updateBrand(accessToken: string, brandId: string, dto: UpdateBrandRequest): Promise<BrandDetailResponse>;
    deleteBrand(accessToken: string, brandId: string): Promise<{
        deleted: boolean;
    }>;
}
