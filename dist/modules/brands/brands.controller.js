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
const brands_service_1 = require("./brands.service");
const brand_dto_1 = require("./dto/brand.dto");
let BrandsController = class BrandsController {
    brandsService;
    constructor(brandsService) {
        this.brandsService = brandsService;
    }
    async getMyBrands(authHeader) {
        const token = authHeader?.replace('Bearer ', '');
        return this.brandsService.getMyBrands(token);
    }
    async getBrand(authHeader, brandId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.brandsService.getBrand(token, brandId);
    }
    async createBrand(authHeader, dto) {
        const token = authHeader?.replace('Bearer ', '');
        return this.brandsService.createBrand(token, dto);
    }
    async updateBrand(authHeader, brandId, dto) {
        const token = authHeader?.replace('Bearer ', '');
        return this.brandsService.updateBrand(token, brandId, dto);
    }
    async deleteBrand(authHeader, brandId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.brandsService.deleteBrand(token, brandId);
    }
};
exports.BrandsController = BrandsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "getMyBrands", null);
__decorate([
    (0, common_1.Get)(':brandId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "getBrand", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, brand_dto_1.CreateBrandRequest]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "createBrand", null);
__decorate([
    (0, common_1.Patch)(':brandId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('brandId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, brand_dto_1.UpdateBrandRequest]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "updateBrand", null);
__decorate([
    (0, common_1.Delete)(':brandId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BrandsController.prototype, "deleteBrand", null);
exports.BrandsController = BrandsController = __decorate([
    (0, common_1.Controller)('admin/brands'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [brands_service_1.BrandsService])
], BrandsController);
//# sourceMappingURL=brands.controller.js.map