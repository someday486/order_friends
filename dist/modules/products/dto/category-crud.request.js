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
exports.ReorderCategoriesRequest = exports.ReorderCategoryItem = exports.UpdateCategoryRequest = exports.CreateCategoryRequest = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class CreateCategoryRequest {
    branchId;
    name;
    sortOrder;
    isActive;
}
exports.CreateCategoryRequest = CreateCategoryRequest;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCategoryRequest.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCategoryRequest.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateCategoryRequest.prototype, "sortOrder", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateCategoryRequest.prototype, "isActive", void 0);
class UpdateCategoryRequest {
    name;
    sortOrder;
    isActive;
}
exports.UpdateCategoryRequest = UpdateCategoryRequest;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateCategoryRequest.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateCategoryRequest.prototype, "sortOrder", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateCategoryRequest.prototype, "isActive", void 0);
class ReorderCategoryItem {
    id;
    sortOrder;
}
exports.ReorderCategoryItem = ReorderCategoryItem;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReorderCategoryItem.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ReorderCategoryItem.prototype, "sortOrder", void 0);
class ReorderCategoriesRequest {
    branchId;
    items;
}
exports.ReorderCategoriesRequest = ReorderCategoriesRequest;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReorderCategoriesRequest.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ReorderCategoryItem),
    __metadata("design:type", Array)
], ReorderCategoriesRequest.prototype, "items", void 0);
//# sourceMappingURL=category-crud.request.js.map