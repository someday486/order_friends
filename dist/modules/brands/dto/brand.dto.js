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
exports.UpdateBrandRequest = exports.CreateBrandRequest = exports.BrandDetailResponse = exports.BrandListItemResponse = void 0;
const class_validator_1 = require("class-validator");
class BrandListItemResponse {
    id;
    name;
    slug;
    bizName;
    bizRegNo;
    createdAt;
}
exports.BrandListItemResponse = BrandListItemResponse;
class BrandDetailResponse {
    id;
    name;
    slug;
    ownerUserId;
    bizName;
    bizRegNo;
    createdAt;
}
exports.BrandDetailResponse = BrandDetailResponse;
class CreateBrandRequest {
    name;
    slug;
    bizName;
    bizRegNo;
}
exports.CreateBrandRequest = CreateBrandRequest;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBrandRequest.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBrandRequest.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBrandRequest.prototype, "bizName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateBrandRequest.prototype, "bizRegNo", void 0);
class UpdateBrandRequest {
    name;
    slug;
    bizName;
    bizRegNo;
}
exports.UpdateBrandRequest = UpdateBrandRequest;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBrandRequest.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBrandRequest.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBrandRequest.prototype, "bizName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateBrandRequest.prototype, "bizRegNo", void 0);
//# sourceMappingURL=brand.dto.js.map