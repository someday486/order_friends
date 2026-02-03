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
const admin_guard_1 = require("../../common/guards/admin.guard");
const members_service_1 = require("./members.service");
const member_dto_1 = require("./dto/member.dto");
let MembersController = class MembersController {
    membersService;
    constructor(membersService) {
        this.membersService = membersService;
    }
    async getBrandMembers(req, brandId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.membersService.getBrandMembers(req.accessToken, brandId, req.isAdmin);
    }
    async addBrandMember(req, brandId, body) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.membersService.addBrandMember(req.accessToken, brandId, body.userId, body.role, req.isAdmin);
    }
    async updateBrandMember(req, brandId, userId, dto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.membersService.updateBrandMember(req.accessToken, brandId, userId, dto, req.isAdmin);
    }
    async removeBrandMember(req, brandId, userId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.membersService.removeBrandMember(req.accessToken, brandId, userId, req.isAdmin);
    }
    async getBranchMembers(req, branchId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.membersService.getBranchMembers(req.accessToken, branchId, req.isAdmin);
    }
    async addBranchMember(req, dto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.membersService.addBranchMember(req.accessToken, dto, req.isAdmin);
    }
    async updateBranchMember(req, branchId, userId, dto) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.membersService.updateBranchMember(req.accessToken, branchId, userId, dto, req.isAdmin);
    }
    async removeBranchMember(req, branchId, userId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.membersService.removeBranchMember(req.accessToken, branchId, userId, req.isAdmin);
    }
};
exports.MembersController = MembersController;
__decorate([
    (0, common_1.Get)('brand/:brandId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('brandId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getBrandMembers", null);
__decorate([
    (0, common_1.Post)('brand/:brandId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('brandId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "addBrandMember", null);
__decorate([
    (0, common_1.Patch)('brand/:brandId/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('brandId')),
    __param(2, (0, common_1.Param)('userId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, member_dto_1.UpdateBrandMemberRequest]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "updateBrandMember", null);
__decorate([
    (0, common_1.Delete)('brand/:brandId/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('brandId')),
    __param(2, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "removeBrandMember", null);
__decorate([
    (0, common_1.Get)('branch/:branchId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "getBranchMembers", null);
__decorate([
    (0, common_1.Post)('branch'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, member_dto_1.AddBranchMemberRequest]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "addBranchMember", null);
__decorate([
    (0, common_1.Patch)('branch/:branchId/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __param(2, (0, common_1.Param)('userId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, member_dto_1.UpdateBranchMemberRequest]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "updateBranchMember", null);
__decorate([
    (0, common_1.Delete)('branch/:branchId/:userId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('branchId')),
    __param(2, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], MembersController.prototype, "removeBranchMember", null);
exports.MembersController = MembersController = __decorate([
    (0, common_1.Controller)('admin/members'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, admin_guard_1.AdminGuard),
    __metadata("design:paramtypes", [members_service_1.MembersService])
], MembersController);
//# sourceMappingURL=members.controller.js.map