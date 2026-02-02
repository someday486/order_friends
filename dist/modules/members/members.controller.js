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
exports.MembersController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/guards/auth.guard");
const members_service_1 = require("./members.service");
const member_dto_1 = require("./dto/member.dto");
let MembersController = class MembersController {
    membersService;
    constructor(membersService) {
        this.membersService = membersService;
    }
    async getBrandMembers(authHeader, brandId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.membersService.getBrandMembers(token, brandId);
    }
    async addBrandMember(authHeader, brandId, body) {
        const token = authHeader?.replace('Bearer ', '');
        return this.membersService.addBrandMember(token, brandId, body.userId, body.role);
    }
    async updateBrandMember(authHeader, brandId, userId, dto) {
        const token = authHeader?.replace('Bearer ', '');
        return this.membersService.updateBrandMember(token, brandId, userId, dto);
    }
    async removeBrandMember(authHeader, brandId, userId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.membersService.removeBrandMember(token, brandId, userId);
    }
    async getBranchMembers(authHeader, branchId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.membersService.getBranchMembers(token, branchId);
    }
    async addBranchMember(authHeader, dto) {
        const token = authHeader?.replace('Bearer ', '');
        return this.membersService.addBranchMember(token, dto);
    }
    async updateBranchMember(authHeader, branchId, userId, dto) {
        const token = authHeader?.replace('Bearer ', '');
        return this.membersService.updateBranchMember(token, branchId, userId, dto);
    }
    async removeBranchMember(authHeader, branchId, userId) {
        const token = authHeader?.replace('Bearer ', '');
        return this.membersService.removeBranchMember(token, branchId, userId);
    }
};
exports.MembersController = MembersController;
__decorate([
    (0, common_1.Get)('brand/:brandId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getBrandMembers", null);
__decorate([
    (0, common_1.Post)('brand/:brandId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('brandId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "addBrandMember", null);
__decorate([
    (0, common_1.Patch)('brand/:brandId/:userId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('brandId')),
    __param(2, (0, common_1.Param)('userId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, member_dto_1.UpdateBrandMemberRequest]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "updateBrandMember", null);
__decorate([
    (0, common_1.Delete)('brand/:brandId/:userId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('brandId')),
    __param(2, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "removeBrandMember", null);
__decorate([
    (0, common_1.Get)('branch/:branchId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getBranchMembers", null);
__decorate([
    (0, common_1.Post)('branch'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, member_dto_1.AddBranchMemberRequest]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "addBranchMember", null);
__decorate([
    (0, common_1.Patch)('branch/:branchId/:userId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('branchId')),
    __param(2, (0, common_1.Param)('userId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, member_dto_1.UpdateBranchMemberRequest]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "updateBranchMember", null);
__decorate([
    (0, common_1.Delete)('branch/:branchId/:userId'),
    __param(0, (0, common_1.Headers)('authorization')),
    __param(1, (0, common_1.Param)('branchId')),
    __param(2, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "removeBranchMember", null);
exports.MembersController = MembersController = __decorate([
    (0, common_1.Controller)('admin/members'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [members_service_1.MembersService])
], MembersController);
//# sourceMappingURL=members.controller.js.map