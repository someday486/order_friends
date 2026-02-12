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
exports.BranchesController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/guards/auth.guard");
const admin_guard_1 = require("../../common/guards/admin.guard");
const branches_service_1 = require("./branches.service");
const branch_request_1 = require("./dto/branch.request");
let BranchesController = class BranchesController {
    branchesService;
    constructor(branchesService) {
        this.branchesService = branchesService;
    }
    async getBranches(req, brandId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.branchesService.getBranches(req.accessToken, brandId, req.isAdmin);
    }
    async getBranch(req, branchId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.branchesService.getBranch(req.accessToken, branchId, req.isAdmin);
    }
    async createBranch(dto, req) {
        const brandId = dto.brandId ?? req.brandId ?? req.query?.brandId;
        if (!brandId) {
            throw new common_1.BadRequestException('brandId is required');
        }
        if (!dto?.name || !dto?.slug) {
            throw new common_1.BadRequestException('name and slug are required');
        }
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.branchesService.createBranch(req.accessToken, { ...dto, brandId }, req.isAdmin);
    }
    async updateBranch(req, branchId, dto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.branchesService.updateBranch(req.accessToken, branchId, dto, req.isAdmin);
    }
    async deleteBranch(req, branchId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.branchesService.deleteBranch(req.accessToken, branchId, req.isAdmin);
    }
};
exports.BranchesController = BranchesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "getBranches", null);
__decorate([
    (0, common_1.Get)(':branchId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "getBranch", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [branch_request_1.CreateBranchRequest, Object]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "createBranch", null);
__decorate([
    (0, common_1.Patch)(':branchId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, branch_request_1.UpdateBranchRequest]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "updateBranch", null);
__decorate([
    (0, common_1.Delete)(':branchId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "deleteBranch", null);
exports.BranchesController = BranchesController = __decorate([
    (0, common_1.Controller)('admin/branches'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [branches_service_1.BranchesService])
], BranchesController);
//# sourceMappingURL=branches.controller.js.map