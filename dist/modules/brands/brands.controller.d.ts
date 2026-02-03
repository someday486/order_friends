import { BrandsService } from './brands.service';
import { CreateBrandRequest, UpdateBrandRequest } from './dto/brand.dto';
export declare class BrandsController {
    private readonly brandsService;
    constructor(brandsService: BrandsService);
    getMyBrands(authHeader: string): Promise<import("./dto/brand.dto").BrandListItemResponse[]>;
    getBrand(authHeader: string, brandId: string): Promise<import("./dto/brand.dto").BrandDetailResponse>;
    createBrand(authHeader: string, dto: CreateBrandRequest): Promise<import("./dto/brand.dto").BrandDetailResponse>;
    updateBrand(authHeader: string, brandId: string, dto: UpdateBrandRequest): Promise<import("./dto/brand.dto").BrandDetailResponse>;
    deleteBrand(authHeader: string, brandId: string): Promise<{
        deleted: boolean;
    }>;
}
