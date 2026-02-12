"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var InventoryController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const customer_guard_1 = require("../../common/guards/customer.guard");
const inventory_service_1 = require("./inventory.service");
const inventory_dto_1 = require("./dto/inventory.dto");
let InventoryController = InventoryController_1 = class InventoryController {
    inventoryService;
    logger = new common_1.Logger(InventoryController_1.name);
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    async getInventoryList(req, branchId) {
        if (!req.user)
            throw new Error('Missing user');
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        this.logger.log(`User ${req.user.id} fetching inventory for branch ${branchId}`);
        return this.inventoryService.getInventoryList(req.user.id, branchId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async getLowStockAlerts(req, branchId) {
        if (!req.user)
            throw new Error('Missing user');
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        this.logger.log(`User ${req.user.id} fetching low stock alerts for branch ${branchId}`);
        return this.inventoryService.getLowStockAlerts(req.user.id, branchId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async getInventoryLogs(req, branchId, productId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} fetching inventory logs (branch: ${branchId}, product: ${productId})`);
        return this.inventoryService.getInventoryLogs(req.user.id, branchId, productId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async bulkAdjustInventory(req, dto) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} bulk adjusting ${dto.adjustments.length} inventory items`);
        return this.inventoryService.bulkAdjustInventory(req.user.id, dto, req.brandMemberships || [], req.branchMemberships || []);
    }
    async getInventoryByProduct(req, productId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} fetching inventory for product ${productId}`);
        return this.inventoryService.getInventoryByProduct(req.user.id, productId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async updateInventory(req, productId, dto) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} updating inventory for product ${productId}`);
        return this.inventoryService.updateInventory(req.user.id, productId, dto, req.brandMemberships || [], req.branchMemberships || []);
    }
    async adjustInventory(req, productId, dto) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} adjusting inventory for product ${productId}`);
        return this.inventoryService.adjustInventory(req.user.id, productId, dto, req.brandMemberships || [], req.branchMemberships || []);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '지점의 재고 목록 조회',
        description: '내가 멤버로 등록된 지점의 재고 목록을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '재고 목록 조회 성공',
        type: [inventory_dto_1.InventoryListResponse],
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getInventoryList", null);
__decorate([
    (0, common_1.Get)('alerts'),
    (0, swagger_1.ApiOperation)({
        summary: '낮은 재고 알림 조회',
        description: '재고가 임계값 이하인 상품 목록을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '낮은 재고 알림 조회 성공',
        type: [inventory_dto_1.InventoryAlertResponse],
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getLowStockAlerts", null);
__decorate([
    (0, common_1.Get)('logs'),
    (0, swagger_1.ApiOperation)({
        summary: '재고 변경 로그 조회',
        description: '재고 변경 내역을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'productId', description: '상품 ID', required: false }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '재고 로그 조회 성공',
        type: [inventory_dto_1.InventoryLogResponse],
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Query)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getInventoryLogs", null);
__decorate([
    (0, common_1.Post)('bulk-adjust'),
    (0, swagger_1.ApiOperation)({
        summary: '재고 일괄 조정',
        description: 'OWNER 또는 ADMIN만 여러 상품의 재고를 한번에 조정할 수 있습니다.',
    }),
    (0, swagger_1.ApiBody)({ type: inventory_dto_1.BulkAdjustInventoryRequest }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '재고 일괄 조정 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음 (OWNER/ADMIN만 가능)' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, inventory_dto_1.BulkAdjustInventoryRequest]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "bulkAdjustInventory", null);
__decorate([
    (0, common_1.Get)(':productId'),
    (0, swagger_1.ApiOperation)({
        summary: '특정 상품의 재고 조회',
        description: '특정 상품의 재고 정보를 조회합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '재고 조회 성공',
        type: inventory_dto_1.InventoryDetailResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '재고를 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "getInventoryByProduct", null);
__decorate([
    (0, common_1.Patch)(':productId'),
    (0, swagger_1.ApiOperation)({
        summary: '재고 수량 업데이트',
        description: 'OWNER 또는 ADMIN만 재고 수량을 업데이트할 수 있습니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiBody)({ type: inventory_dto_1.UpdateInventoryRequest }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '재고 업데이트 성공',
        type: inventory_dto_1.InventoryDetailResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음 (OWNER/ADMIN만 가능)' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '재고를 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventory_dto_1.UpdateInventoryRequest]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "updateInventory", null);
__decorate([
    (0, common_1.Post)(':productId/adjust'),
    (0, swagger_1.ApiOperation)({
        summary: '재고 수동 조정',
        description: 'OWNER 또는 ADMIN만 재고를 수동으로 조정할 수 있습니다. 로그에 기록됩니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiBody)({ type: inventory_dto_1.AdjustInventoryRequest }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '재고 조정 성공',
        type: inventory_dto_1.InventoryDetailResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음 (OWNER/ADMIN만 가능)' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '재고를 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, inventory_dto_1.AdjustInventoryRequest]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "adjustInventory", null);
exports.InventoryController = InventoryController = InventoryController_1 = __decorate([
    (0, swagger_1.ApiTags)('customer-inventory'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/inventory'),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map