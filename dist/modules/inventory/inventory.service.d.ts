import { SupabaseService } from '../../infra/supabase/supabase.service';
import type { BrandMembership, BranchMembership } from '../../common/types/auth-request';
import { UpdateInventoryRequest, AdjustInventoryRequest, InventoryListResponse, InventoryDetailResponse, InventoryAlertResponse, InventoryLogResponse } from './dto/inventory.dto';
export declare class InventoryService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    private checkBranchAccess;
    private checkProductAccess;
    private checkModificationPermission;
    private createInventoryLog;
    getInventoryList(userId: string, branchId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<InventoryListResponse[]>;
    getInventoryByProduct(userId: string, productId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<InventoryDetailResponse>;
    updateInventory(userId: string, productId: string, dto: UpdateInventoryRequest, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<InventoryDetailResponse>;
    adjustInventory(userId: string, productId: string, dto: AdjustInventoryRequest, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<InventoryDetailResponse>;
    getLowStockAlerts(userId: string, branchId: string, brandMemberships: BrandMembership[], branchMemberships: BranchMembership[]): Promise<InventoryAlertResponse[]>;
    getInventoryLogs(userId: string, branchId?: string, productId?: string, brandMemberships?: BrandMembership[], branchMemberships?: BranchMembership[]): Promise<InventoryLogResponse[]>;
}
