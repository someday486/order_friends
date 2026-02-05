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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicOrderController = void 0;
const common_1 = require("@nestjs/common");
const public_order_service_1 = require("./public-order.service");
const public_order_dto_1 = require("./dto/public-order.dto");
const user_rate_limit_decorator_1 = require("../../common/decorators/user-rate-limit.decorator");
const user_rate_limit_guard_1 = require("../../common/guards/user-rate-limit.guard");
let PublicOrderController = class PublicOrderController {
    publicOrderService;
    constructor(publicOrderService) {
        this.publicOrderService = publicOrderService;
    }
    async getBranch(branchId) {
        return this.publicOrderService.getBranch(branchId);
    }
    async getBranchBySlug(slug) {
        return this.publicOrderService.getBranchBySlug(slug);
    }
    async getBranchByBrandSlug(brandSlug, branchSlug) {
        return this.publicOrderService.getBranchByBrandSlug(brandSlug, branchSlug);
    }
    async getProducts(branchId) {
        return this.publicOrderService.getProducts(branchId);
    }
    async createOrder(dto) {
        return this.publicOrderService.createOrder(dto);
    }
    async getOrder(orderIdOrNo) {
        return this.publicOrderService.getOrder(orderIdOrNo);
    }
};
exports.PublicOrderController = PublicOrderController;
__decorate([
    (0, common_1.Get)('branches/:branchId'),
    __param(0, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicOrderController.prototype, "getBranch", null);
__decorate([
    (0, common_1.Get)('branches/slug/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicOrderController.prototype, "getBranchBySlug", null);
__decorate([
    (0, common_1.Get)('brands/:brandSlug/branches/:branchSlug'),
    __param(0, (0, common_1.Param)('brandSlug')),
    __param(1, (0, common_1.Param)('branchSlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PublicOrderController.prototype, "getBranchByBrandSlug", null);
__decorate([
    (0, common_1.Get)('branches/:branchId/products'),
    __param(0, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicOrderController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Post)('orders'),
    (0, common_1.UseGuards)(user_rate_limit_guard_1.UserRateLimitGuard),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 10, duration: 60, blockDuration: 300 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [public_order_dto_1.CreatePublicOrderRequest]),
    __metadata("design:returntype", Promise)
], PublicOrderController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Get)('orders/:orderIdOrNo'),
    __param(0, (0, common_1.Param)('orderIdOrNo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicOrderController.prototype, "getOrder", null);
exports.PublicOrderController = PublicOrderController = __decorate([
    (0, common_1.Controller)('public'),
    __metadata("design:paramtypes", [public_order_service_1.PublicOrderService])
], PublicOrderController);
//# sourceMappingURL=public-order.controller.js.map