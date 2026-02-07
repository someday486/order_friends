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
var CustomerProductsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerProductsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const customer_guard_1 = require("../../common/guards/customer.guard");
const customer_products_service_1 = require("./customer-products.service");
const create_product_request_1 = require("../../modules/products/dto/create-product.request");
const update_product_request_1 = require("../../modules/products/dto/update-product.request");
let CustomerProductsController = CustomerProductsController_1 = class CustomerProductsController {
    productsService;
    logger = new common_1.Logger(CustomerProductsController_1.name);
    constructor(productsService) {
        this.productsService = productsService;
    }
    async getProducts(req, branchId) {
        if (!req.user)
            throw new Error('Missing user');
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        this.logger.log(`User ${req.user.id} fetching products for branch ${branchId}`);
        return this.productsService.getMyProducts(req.user.id, branchId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async getCategories(req, branchId) {
        if (!req.user)
            throw new Error('Missing user');
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        this.logger.log(`User ${req.user.id} fetching categories for branch ${branchId}`);
        return this.productsService.getMyCategories(req.user.id, branchId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async getProduct(req, productId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} fetching product ${productId}`);
        return this.productsService.getMyProduct(req.user.id, productId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async createProduct(req, dto) {
        if (!req.user)
            throw new Error('Missing user');
        if (!dto.branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        this.logger.log(`User ${req.user.id} creating product for branch ${dto.branchId}`);
        return this.productsService.createMyProduct(req.user.id, dto, req.brandMemberships || [], req.branchMemberships || []);
    }
    async updateProduct(req, productId, dto) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} updating product ${productId}`);
        return this.productsService.updateMyProduct(req.user.id, productId, dto, req.brandMemberships || [], req.branchMemberships || []);
    }
    async deleteProduct(req, productId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} deleting product ${productId}`);
        return this.productsService.deleteMyProduct(req.user.id, productId, req.brandMemberships || [], req.branchMemberships || []);
    }
};
exports.CustomerProductsController = CustomerProductsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '내 지점의 상품 목록 조회',
        description: '내가 멤버로 등록된 지점의 상품 목록을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 목록 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerProductsController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, swagger_1.ApiOperation)({
        summary: '지점의 상품 카테고리 목록 조회',
        description: '내가 멤버로 등록된 지점의 상품 카테고리 목록을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '카테고리 목록 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerProductsController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)(':productId'),
    (0, swagger_1.ApiOperation)({
        summary: '내 상품 상세 조회',
        description: '내가 멤버로 등록된 지점의 상품 상세 정보를 조회합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 상세 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '상품을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerProductsController.prototype, "getProduct", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: '상품 생성',
        description: '내가 OWNER 또는 ADMIN 권한을 가진 지점에 새로운 상품을 생성합니다.',
    }),
    (0, swagger_1.ApiBody)({ type: create_product_request_1.CreateProductRequest }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '상품 생성 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_product_request_1.CreateProductRequest]),
    __metadata("design:returntype", Promise)
], CustomerProductsController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Patch)(':productId'),
    (0, swagger_1.ApiOperation)({
        summary: '상품 수정',
        description: '내가 OWNER 또는 ADMIN 권한을 가진 지점의 상품을 수정합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiBody)({ type: update_product_request_1.UpdateProductRequest }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 수정 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '상품을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_product_request_1.UpdateProductRequest]),
    __metadata("design:returntype", Promise)
], CustomerProductsController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)(':productId'),
    (0, swagger_1.ApiOperation)({
        summary: '상품 삭제',
        description: '내가 OWNER 또는 ADMIN 권한을 가진 지점의 상품을 삭제합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: '상품 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '상품 삭제 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '상품을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerProductsController.prototype, "deleteProduct", null);
exports.CustomerProductsController = CustomerProductsController = CustomerProductsController_1 = __decorate([
    (0, swagger_1.ApiTags)('customer-products'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/products'),
    __metadata("design:paramtypes", [customer_products_service_1.CustomerProductsService])
], CustomerProductsController);
//# sourceMappingURL=customer-products.controller.js.map