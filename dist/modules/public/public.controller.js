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
exports.PublicController = void 0;
const common_1 = require("@nestjs/common");
const public_service_1 = require("./public.service");
const public_dto_1 = require("./dto/public.dto");
const user_rate_limit_decorator_1 = require("../../common/decorators/user-rate-limit.decorator");
let PublicController = class PublicController {
    publicService;
    constructor(publicService) {
        this.publicService = publicService;
    }
    async getBranch(branchId) {
        return this.publicService.getBranch(branchId);
    }
    async getProducts(branchId) {
        return this.publicService.getProducts(branchId);
    }
    async createOrder(dto) {
        return this.publicService.createOrder(dto);
    }
    async getOrder(orderId) {
        return this.publicService.getOrder(orderId);
    }
};
exports.PublicController = PublicController;
__decorate([
    (0, common_1.Get)('branch/:branchId'),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 60, duration: 60 }),
    __param(0, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicController.prototype, "getBranch", null);
__decorate([
    (0, common_1.Get)('branch/:branchId/products'),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 30, duration: 60 }),
    __param(0, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Post)('orders'),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 5, duration: 60, blockDuration: 300 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [public_dto_1.CreatePublicOrderRequest]),
    __metadata("design:returntype", Promise)
], PublicController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Get)('orders/:orderId'),
    (0, user_rate_limit_decorator_1.UserRateLimit)({ points: 30, duration: 60 }),
    __param(0, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PublicController.prototype, "getOrder", null);
exports.PublicController = PublicController = __decorate([
    (0, common_1.Controller)('public'),
    __metadata("design:paramtypes", [public_service_1.PublicService])
], PublicController);
//# sourceMappingURL=public.controller.js.map