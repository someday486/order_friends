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
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const admin_guard_1 = require("../../common/guards/admin.guard");
const products_service_1 = require("./products.service");
const create_product_request_1 = require("./dto/create-product.request");
const update_product_request_1 = require("./dto/update-product.request");
const search_dto_1 = require("../../common/dto/search.dto");
let ProductsController = class ProductsController {
    productsService;
    constructor(productsService) {
        this.productsService = productsService;
    }
    async getProducts(req, branchId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.productsService.getProducts(req.accessToken, branchId, req.isAdmin);
    }
    async searchProducts(req, branchId, searchDto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.productsService.searchProducts(req.accessToken, branchId, searchDto, req.isAdmin);
    }
    async getCategories(req, branchId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.productsService.getCategories(req.accessToken, branchId, req.isAdmin);
    }
    async getProduct(req, productId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.productsService.getProduct(req.accessToken, productId, req.isAdmin);
    }
    async createProduct(req, dto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.productsService.createProduct(req.accessToken, dto, req.isAdmin);
    }
    async updateProduct(req, productId, dto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.productsService.updateProduct(req.accessToken, productId, dto, req.isAdmin);
    }
    async deleteProduct(req, productId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.productsService.deleteProduct(req.accessToken, productId, req.isAdmin);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '상품 목록 조회',
        description: '지점의 상품 목록을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 목록 조회 성공' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Get)('search'),
    (0, swagger_1.ApiOperation)({
        summary: '상품 검색',
        description: '다양한 필터로 상품을 검색합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 검색 성공' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, search_dto_1.ProductSearchDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "searchProducts", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, swagger_1.ApiOperation)({
        summary: '상품 카테고리 목록 조회',
        description: '지점의 상품 카테고리 목록을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '카테고리 목록 조회 성공' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)(':productId'),
    (0, swagger_1.ApiOperation)({
        summary: '상품 상세 조회',
        description: '특정 상품의 상세 정보를 조회합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 상세 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '상품을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getProduct", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: '상품 생성',
        description: '새로운 상품을 생성합니다.',
    }),
    (0, swagger_1.ApiBody)({ type: create_product_request_1.CreateProductRequest }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '상품 생성 성공' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_product_request_1.CreateProductRequest]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Patch)(':productId'),
    (0, swagger_1.ApiOperation)({
        summary: '상품 수정',
        description: '기존 상품 정보를 수정합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiBody)({ type: update_product_request_1.UpdateProductRequest }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 수정 성공' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '상품을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_product_request_1.UpdateProductRequest]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)(':productId'),
    (0, swagger_1.ApiOperation)({ summary: '상품 삭제', description: '상품을 삭제합니다.' }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 삭제 성공' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '상품을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "deleteProduct", null);
exports.ProductsController = ProductsController = __decorate([
    (0, swagger_1.ApiTags)('products'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/products'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
//# sourceMappingURL=products.controller.js.map