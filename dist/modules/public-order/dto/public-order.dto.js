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
exports.CreatePublicOrderRequest = exports.PaymentMethod = exports.OrderItemDto = exports.OrderItemOptionDto = exports.PublicOrderResponse = exports.PublicCategoryResponse = exports.PublicProductResponse = exports.PublicProductOptionResponse = exports.PublicBranchResponse = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class PublicBranchResponse {
    id;
    name;
    brandName;
    logoUrl;
    coverImageUrl;
}
exports.PublicBranchResponse = PublicBranchResponse;
class PublicProductOptionResponse {
    id;
    name;
    priceDelta;
}
exports.PublicProductOptionResponse = PublicProductOptionResponse;
class PublicProductResponse {
    id;
    name;
    description;
    price;
    imageUrl;
    categoryId;
    categoryName;
    sortOrder;
    options;
}
exports.PublicProductResponse = PublicProductResponse;
class PublicCategoryResponse {
    id;
    name;
    sortOrder;
}
exports.PublicCategoryResponse = PublicCategoryResponse;
class PublicOrderResponse {
    id;
    orderNo;
    status;
    totalAmount;
    createdAt;
    items;
}
exports.PublicOrderResponse = PublicOrderResponse;
class OrderItemOptionDto {
    optionId;
}
exports.OrderItemOptionDto = OrderItemOptionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderItemOptionDto.prototype, "optionId", void 0);
class OrderItemDto {
    productId;
    qty;
    options;
}
exports.OrderItemDto = OrderItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderItemDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], OrderItemDto.prototype, "qty", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OrderItemOptionDto),
    __metadata("design:type", Array)
], OrderItemDto.prototype, "options", void 0);
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["TRANSFER"] = "TRANSFER";
    PaymentMethod["CASH"] = "CASH";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
class CreatePublicOrderRequest {
    branchId;
    customerName;
    customerPhone;
    customerAddress1;
    customerAddress2;
    customerMemo;
    paymentMethod = PaymentMethod.CARD;
    items;
}
exports.CreatePublicOrderRequest = CreatePublicOrderRequest;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePublicOrderRequest.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePublicOrderRequest.prototype, "customerName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePublicOrderRequest.prototype, "customerPhone", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePublicOrderRequest.prototype, "customerAddress1", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePublicOrderRequest.prototype, "customerAddress2", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePublicOrderRequest.prototype, "customerMemo", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(PaymentMethod),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePublicOrderRequest.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OrderItemDto),
    __metadata("design:type", Array)
], CreatePublicOrderRequest.prototype, "items", void 0);
//# sourceMappingURL=public-order.dto.js.map