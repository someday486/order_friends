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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBranchMemberRequest = exports.AddBranchMemberRequest = exports.UpdateBrandMemberRequest = exports.InviteBrandMemberRequest = exports.BranchMemberResponse = exports.BrandMemberResponse = exports.MemberStatus = exports.BranchRole = exports.BrandRole = void 0;
const class_validator_1 = require("class-validator");
var BrandRole;
(function (BrandRole) {
    BrandRole["OWNER"] = "OWNER";
    BrandRole["ADMIN"] = "ADMIN";
    BrandRole["MANAGER"] = "MANAGER";
    BrandRole["MEMBER"] = "MEMBER";
})(BrandRole || (exports.BrandRole = BrandRole = {}));
var BranchRole;
(function (BranchRole) {
    BranchRole["BRANCH_OWNER"] = "BRANCH_OWNER";
    BranchRole["BRANCH_ADMIN"] = "BRANCH_ADMIN";
    BranchRole["STAFF"] = "STAFF";
    BranchRole["VIEWER"] = "VIEWER";
})(BranchRole || (exports.BranchRole = BranchRole = {}));
var MemberStatus;
(function (MemberStatus) {
    MemberStatus["INVITED"] = "INVITED";
    MemberStatus["ACTIVE"] = "ACTIVE";
    MemberStatus["SUSPENDED"] = "SUSPENDED";
    MemberStatus["LEFT"] = "LEFT";
})(MemberStatus || (exports.MemberStatus = MemberStatus = {}));
class BrandMemberResponse {
    id;
    brandId;
    userId;
    email;
    displayName;
    role;
    status;
    createdAt;
}
exports.BrandMemberResponse = BrandMemberResponse;
class BranchMemberResponse {
    id;
    branchId;
    userId;
    email;
    displayName;
    role;
    status;
    createdAt;
}
exports.BranchMemberResponse = BranchMemberResponse;
class InviteBrandMemberRequest {
    brandId;
    email;
    role = BrandRole.MEMBER;
}
exports.InviteBrandMemberRequest = InviteBrandMemberRequest;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InviteBrandMemberRequest.prototype, "brandId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], InviteBrandMemberRequest.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(BrandRole),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InviteBrandMemberRequest.prototype, "role", void 0);
class UpdateBrandMemberRequest {
    role;
    status;
}
exports.UpdateBrandMemberRequest = UpdateBrandMemberRequest;
__decorate([
    (0, class_validator_1.IsEnum)(BrandRole),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBrandMemberRequest.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(MemberStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBrandMemberRequest.prototype, "status", void 0);
class AddBranchMemberRequest {
    branchId;
    userId;
    role = BranchRole.STAFF;
}
exports.AddBranchMemberRequest = AddBranchMemberRequest;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddBranchMemberRequest.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddBranchMemberRequest.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(BranchRole),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AddBranchMemberRequest.prototype, "role", void 0);
class UpdateBranchMemberRequest {
    role;
    status;
}
exports.UpdateBranchMemberRequest = UpdateBranchMemberRequest;
__decorate([
    (0, class_validator_1.IsEnum)(BranchRole),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBranchMemberRequest.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(MemberStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBranchMemberRequest.prototype, "status", void 0);
//# sourceMappingURL=member.dto.js.map