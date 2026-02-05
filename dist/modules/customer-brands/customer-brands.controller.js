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
exports.CustomerBrandsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const customer_guard_1 = require("../../common/guards/customer.guard");
const customer_brands_service_1 = require("./customer-brands.service");
let CustomerBrandsController = class CustomerBrandsController {
    brandsService;
    constructor(brandsService) {
        this.brandsService = brandsService;
    }
    async getMyBrands(req) {
        if (!req.user)
            throw new Error('Missing user');
        return this.brandsService.getMyBrands(req.user.id, req.brandMemberships || []);
    }
    async getMyBrand(brandId, req) {
        if (!req.user)
            throw new Error('Missing user');
        return this.brandsService.getMyBrand(brandId, req.user.id, req.brandMemberships || []);
    }
    async updateMyBrand(brandId, updateData, req) {
        if (!req.user)
            throw new Error('Missing user');
        return this.brandsService.updateMyBrand(brandId, updateData, req.user.id, req.brandMemberships || []);
    }
};
exports.CustomerBrandsController = CustomerBrandsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '내 브랜드 목록 조회',
        description: '본인이 멤버로 등록된 브랜드 목록을 조회합니다.',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '브랜드 목록 조회 성공' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerBrandsController.prototype, "getMyBrands", null);
__decorate([
    (0, common_1.Get)(':brandId'),
    (0, swagger_1.ApiOperation)({
        summary: '내 브랜드 상세 조회',
        description: '내가 멤버로 등록된 브랜드의 상세 정보를 조회합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'brandId', description: '브랜드 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '브랜드 상세 조회 성공' }),
    (0, swagger_1.ApiResponse)({
        status: 403,
        description: '권한 없음 - 해당 브랜드의 멤버가 아님',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '브랜드를 찾을 수 없음' }),
    __param(0, (0, common_1.Param)('brandId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CustomerBrandsController.prototype, "getMyBrand", null);
__decorate([
    (0, common_1.Patch)(':brandId'),
    (0, swagger_1.ApiOperation)({
        summary: '내 브랜드 수정',
        description: '내가 OWNER 또는 ADMIN 권한을 가진 브랜드를 수정합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'brandId', description: '브랜드 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '브랜드 수정 성공' }),
    (0, swagger_1.ApiResponse)({
        status: 403,
        description: '권한 없음 - OWNER/ADMIN 권한 필요',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '브랜드를 찾을 수 없음' }),
    __param(0, (0, common_1.Param)('brandId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], CustomerBrandsController.prototype, "updateMyBrand", null);
exports.CustomerBrandsController = CustomerBrandsController = __decorate([
    (0, swagger_1.ApiTags)('customer-brands'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/brands'),
    __metadata("design:paramtypes", [customer_brands_service_1.CustomerBrandsService])
], CustomerBrandsController);
//# sourceMappingURL=customer-brands.controller.js.map