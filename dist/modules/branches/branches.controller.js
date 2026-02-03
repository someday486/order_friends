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
const branches_service_1 = require("./branches.service");
const branch_request_1 = require("./dto/branch.request");
let BranchesController = class BranchesController {
    branchesService;
    constructor(branchesService) {
        this.branchesService = branchesService;
    }
    async getBranches(authHeader, brandId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.branchesService.getBranches(token, brandId);
    }
    async getBranch(authHeader, branchId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.branchesService.getBranch(token, branchId);
    }
    async createBranch(authHeader, dto) {
        const token = authHeader?.replace('Bearer ', '');
        return this.branchesService.createBranch(token, dto);
    }
    async updateBranch(authHeader, branchId, dto) {
        const token = authHeader?.replace('Bearer ', '');
        return this.branchesService.updateBranch(token, branchId, dto);
    }
    async deleteBranch(authHeader, branchId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.branchesService.deleteBranch(token, branchId);
    }
};
exports.BranchesController = BranchesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Query)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "getBranches", null);
__decorate([
    (0, common_1.Get)(':branchId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "getBranch", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, branch_request_1.CreateBranchRequest]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "createBranch", null);
__decorate([
    (0, common_1.Patch)(':branchId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('branchId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, branch_request_1.UpdateBranchRequest]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "updateBranch", null);
__decorate([
    (0, common_1.Delete)(':branchId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BranchesController.prototype, "deleteBranch", null);
exports.BranchesController = BranchesController = __decorate([
    (0, common_1.Controller)('admin/branches'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [branches_service_1.BranchesService])
], BranchesController);
//# sourceMappingURL=branches.controller.js.map