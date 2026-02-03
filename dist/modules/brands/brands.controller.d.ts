import type { AuthRequest } from '../../common/types/auth-request';
import { BrandsService } from './brands.service';
import { CreateBrandRequest, UpdateBrandRequest } from './dto/brand.dto';
export declare class BrandsController {
    private readonly brandsService;
    constructor(brandsService: BrandsService);
    getMyBrands(req: AuthRequest): Promise<import("./dto/brand.dto").BrandListItemResponse[]>;
    getBrand(req: AuthRequest, brandId: string): Promise<import("./dto/brand.dto").BrandDetailResponse>;
    createBrand(req: AuthRequest, dto: CreateBrandRequest): Promise<import("./dto/brand.dto").BrandDetailResponse>;
    updateBrand(req: AuthRequest, brandId: string, dto: UpdateBrandRequest): Promise<import("./dto/brand.dto").BrandDetailResponse>;
    deleteBrand(req: AuthRequest, brandId: string): Promise<{
        deleted: boolean;
    }>;
}
