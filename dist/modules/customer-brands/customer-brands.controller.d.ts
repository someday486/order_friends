import type { AuthRequest } from '../../common/types/auth-request';
import { CustomerBrandsService } from './customer-brands.service';
export declare class CustomerBrandsController {
    private readonly brandsService;
    constructor(brandsService: CustomerBrandsService);
    getMyBrands(req: AuthRequest): Promise<{
        myRole: string | null;
        id: any;
        name: any;
        biz_name: any;
        biz_reg_no: any;
        owner_user_id: any;
        created_at: any;
    }[]>;
    getMyBrand(brandId: string, req: AuthRequest): Promise<{
        myRole: string;
        id: any;
        name: any;
        biz_name: any;
        biz_reg_no: any;
        owner_user_id: any;
        created_at: any;
    }>;
    updateMyBrand(brandId: string, updateData: any, req: AuthRequest): Promise<any>;
}
