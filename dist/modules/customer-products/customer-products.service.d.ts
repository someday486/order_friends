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
    getMyCategories(userId: string, branchId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        branchId: any;
        name: any;
        sortOrder: any;
        isActive: any;
        createdAt: any;
    }[]>;
    getMyProducts(userId: string, branchId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<any[]>;
    getMyProduct(userId: string, productId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<any>;
    createMyProduct(userId: string, dto: CreateProductRequest, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<any>;
    updateMyProduct(userId: string, productId: string, dto: UpdateProductRequest, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<any>;
    deleteMyProduct(userId: string, productId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        deleted: boolean;
    }>;
    reorderProducts(userId: string, branchId: string, items: {
        id: string;
        sortOrder: number;
    }[], brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<any[]>;
    createCategory(userId: string, branchId: string, name: string, sortOrder: number | undefined, isActive: boolean | undefined, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        branchId: any;
        name: any;
        sortOrder: any;
        isActive: any;
        createdAt: any;
    }>;
    updateCategory(userId: string, categoryId: string, dto: {
        name?: string;
        sortOrder?: number;
        isActive?: boolean;
    }, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        branchId: any;
        name: any;
        sortOrder: any;
        isActive: any;
        createdAt: any;
    }>;
    deleteCategory(userId: string, categoryId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        deleted: boolean;
    }>;
    reorderCategories(userId: string, branchId: string, items: {
        id: string;
        sortOrder: number;
    }[], brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<{
        id: any;
        branchId: any;
        name: any;
        sortOrder: any;
        isActive: any;
        createdAt: any;
    }[]>;
}
