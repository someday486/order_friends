import type { AuthRequest } from '../../common/types/auth-request';
import { InventoryService } from './inventory.service';
import { UpdateInventoryRequest, AdjustInventoryRequest, InventoryListResponse, InventoryDetailResponse, InventoryAlertResponse, InventoryLogResponse } from './dto/inventory.dto';
export declare class InventoryController {
    private readonly inventoryService;
    private readonly logger;
    constructor(inventoryService: InventoryService);
    getInventoryList(req: AuthRequest, branchId: string): Promise<InventoryListResponse[]>;
    getLowStockAlerts(req: AuthRequest, branchId: string): Promise<InventoryAlertResponse[]>;
    getInventoryLogs(req: AuthRequest, branchId?: string, productId?: string): Promise<InventoryLogResponse[]>;
    getInventoryByProduct(req: AuthRequest, productId: string): Promise<InventoryDetailResponse>;
    updateInventory(req: AuthRequest, productId: string, dto: UpdateInventoryRequest): Promise<InventoryDetailResponse>;
    adjustInventory(req: AuthRequest, productId: string, dto: AdjustInventoryRequest): Promise<InventoryDetailResponse>;
}
