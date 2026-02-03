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
exports.BrandsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/guards/auth.guard");
const admin_guard_1 = require("../../common/guards/admin.guard");
const brands_service_1 = require("./brands.service");
const brand_dto_1 = require("./dto/brand.dto");
let BrandsController = class BrandsController {
    brandsService;
    constructor(brandsService) {
        this.brandsService = brandsService;
    }
    async getMyBrands(req) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.brandsService.getMyBrands(req.accessToken, req.isAdmin);
    }
    async getBrand(req, brandId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.brandsService.getBrand(req.accessToken, brandId, req.isAdmin);
    }
    async createBrand(req, dto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.brandsService.createBrand(req.accessToken, dto, req.isAdmin);
    }
    async updateBrand(req, brandId, dto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.brandsService.updateBrand(req.accessToken, brandId, dto, req.isAdmin);
    }
    async deleteBrand(req, brandId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.brandsService.deleteBrand(req.accessToken, brandId, req.isAdmin);
    }
};
exports.BrandsController = BrandsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "getMyBrands", null);
__decorate([
    (0, common_1.Get)(':brandId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "getBrand", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, brand_dto_1.CreateBrandRequest]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "createBrand", null);
__decorate([
    (0, common_1.Patch)(':brandId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('brandId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, brand_dto_1.UpdateBrandRequest]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "updateBrand", null);
__decorate([
    (0, common_1.Delete)(':brandId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "deleteBrand", null);
exports.BrandsController = BrandsController = __decorate([
    (0, common_1.Controller)('admin/brands'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [brands_service_1.BrandsService])
], BrandsController);
//# sourceMappingURL=brands.controller.js.map