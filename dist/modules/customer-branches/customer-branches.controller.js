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
var CustomerBranchesController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBranchesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const customer_guard_1 = require("../../common/guards/customer.guard");
const customer_branches_service_1 = require("./customer-branches.service");
const branch_request_1 = require("../../modules/branches/dto/branch.request");
let CustomerBranchesController = CustomerBranchesController_1 = class CustomerBranchesController {
    branchesService;
    logger = new common_1.Logger(CustomerBranchesController_1.name);
    constructor(branchesService) {
        this.branchesService = branchesService;
    }
    async getBranches(req, brandId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} fetching branches${brandId ? ` for brand ${brandId}` : ' (all)'}`);
        return this.branchesService.getMyBranches(req.user.id, brandId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async getBranch(req, branchId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} fetching branch ${branchId}`);
        return this.branchesService.getMyBranch(req.user.id, branchId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async createBranch(req, dto) {
        if (!req.user)
            throw new Error('Missing user');
        if (!dto.brandId) {
            throw new common_1.BadRequestException('brandId is required');
        }
        this.logger.log(`User ${req.user.id} creating branch for brand ${dto.brandId}`);
        return this.branchesService.createMyBranch(req.user.id, dto, req.brandMemberships || []);
    }
    async updateBranch(req, branchId, dto) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} updating branch ${branchId}`);
        return this.branchesService.updateMyBranch(req.user.id, branchId, dto, req.brandMemberships || [], req.branchMemberships || []);
    }
    async deleteBranch(req, branchId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} deleting branch ${branchId}`);
        return this.branchesService.deleteMyBranch(req.user.id, branchId, req.brandMemberships || [], req.branchMemberships || []);
    }
};
exports.CustomerBranchesController = CustomerBranchesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '내 브랜드의 지점 목록 조회',
        description: 'brandId가 주어지면 해당 브랜드의 지점만, 없으면 접근 가능한 모든 지점을 반환합니다.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'brandId', description: '브랜드 ID', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '지점 목록 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerBranchesController.prototype, "getBranches", null);
__decorate([
    (0, common_1.Get)(':branchId'),
    (0, swagger_1.ApiOperation)({
        summary: '내 지점 상세 조회',
        description: '내가 멤버로 등록된 지점의 상세 정보를 조회합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'branchId', description: '지점 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '지점 상세 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '지점을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerBranchesController.prototype, "getBranch", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: '지점 생성',
        description: '내가 OWNER 또는 ADMIN 권한을 가진 브랜드에 새로운 지점을 생성합니다.',
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '지점 생성 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, branch_request_1.CreateBranchRequest]),
    __metadata("design:returntype", Promise)
], CustomerBranchesController.prototype, "createBranch", null);
__decorate([
    (0, common_1.Patch)(':branchId'),
    (0, swagger_1.ApiOperation)({
        summary: '지점 수정',
        description: '내가 OWNER 또는 ADMIN 권한을 가진 지점을 수정합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'branchId', description: '지점 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '지점 수정 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '지점을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, branch_request_1.UpdateBranchRequest]),
    __metadata("design:returntype", Promise)
], CustomerBranchesController.prototype, "updateBranch", null);
__decorate([
    (0, common_1.Delete)(':branchId'),
    (0, swagger_1.ApiOperation)({
        summary: '지점 삭제',
        description: '내가 OWNER 또는 ADMIN 권한을 가진 지점을 삭제합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'branchId', description: '지점 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '지점 삭제 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '지점을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerBranchesController.prototype, "deleteBranch", null);
exports.CustomerBranchesController = CustomerBranchesController = CustomerBranchesController_1 = __decorate([
    (0, swagger_1.ApiTags)('customer-branches'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/branches'),
    __metadata("design:paramtypes", [customer_branches_service_1.CustomerBranchesService])
], CustomerBranchesController);
//# sourceMappingURL=customer-branches.controller.js.map