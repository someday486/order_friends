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
exports.AdjustInventoryRequest = exports.TransactionType = exports.UpdateInventoryRequest = exports.InventoryDetailResponse = exports.InventoryLogResponse = exports.InventoryAlertResponse = exports.InventoryListResponse = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class InventoryListResponse {
    id;
    product_id;
    product_name;
    branch_id;
    qty_available;
    qty_reserved;
    qty_sold;
    low_stock_threshold;
    is_low_stock;
    total_quantity;
    image_url;
    category;
    created_at;
    updated_at;
}
exports.InventoryListResponse = InventoryListResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Inventory ID' }),
    __metadata("design:type", String)
], InventoryListResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Product ID' }),
    __metadata("design:type", String)
], InventoryListResponse.prototype, "product_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Product name' }),
    __metadata("design:type", String)
], InventoryListResponse.prototype, "product_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Branch ID' }),
    __metadata("design:type", String)
], InventoryListResponse.prototype, "branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Available quantity' }),
    __metadata("design:type", Number)
], InventoryListResponse.prototype, "qty_available", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Reserved quantity' }),
    __metadata("design:type", Number)
], InventoryListResponse.prototype, "qty_reserved", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total sold quantity' }),
    __metadata("design:type", Number)
], InventoryListResponse.prototype, "qty_sold", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Low stock threshold' }),
    __metadata("design:type", Number)
], InventoryListResponse.prototype, "low_stock_threshold", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Is low stock' }),
    __metadata("design:type", Boolean)
], InventoryListResponse.prototype, "is_low_stock", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Total quantity (available + reserved)' }),
    __metadata("design:type", Number)
], InventoryListResponse.prototype, "total_quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Product image URL' }),
    __metadata("design:type", String)
], InventoryListResponse.prototype, "image_url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Product category' }),
    __metadata("design:type", String)
], InventoryListResponse.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Created at' }),
    __metadata("design:type", String)
], InventoryListResponse.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Updated at' }),
    __metadata("design:type", String)
], InventoryListResponse.prototype, "updated_at", void 0);
class InventoryAlertResponse {
    product_id;
    product_name;
    branch_id;
    branch_name;
    qty_available;
    low_stock_threshold;
    image_url;
}
exports.InventoryAlertResponse = InventoryAlertResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Product ID' }),
    __metadata("design:type", String)
], InventoryAlertResponse.prototype, "product_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Product name' }),
    __metadata("design:type", String)
], InventoryAlertResponse.prototype, "product_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Branch ID' }),
    __metadata("design:type", String)
], InventoryAlertResponse.prototype, "branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Branch name' }),
    __metadata("design:type", String)
], InventoryAlertResponse.prototype, "branch_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Available quantity' }),
    __metadata("design:type", Number)
], InventoryAlertResponse.prototype, "qty_available", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Low stock threshold' }),
    __metadata("design:type", Number)
], InventoryAlertResponse.prototype, "low_stock_threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Product image URL' }),
    __metadata("design:type", String)
], InventoryAlertResponse.prototype, "image_url", void 0);
class InventoryLogResponse {
    id;
    product_id;
    branch_id;
    transaction_type;
    qty_change;
    qty_before;
    qty_after;
    reference_id;
    reference_type;
    notes;
    created_by;
    created_at;
}
exports.InventoryLogResponse = InventoryLogResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Log ID' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Product ID' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "product_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Branch ID' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "branch_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Transaction type' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "transaction_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Quantity change' }),
    __metadata("design:type", Number)
], InventoryLogResponse.prototype, "qty_change", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Quantity before change' }),
    __metadata("design:type", Number)
], InventoryLogResponse.prototype, "qty_before", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Quantity after change' }),
    __metadata("design:type", Number)
], InventoryLogResponse.prototype, "qty_after", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Reference ID (e.g., order_id)' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "reference_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Reference type (e.g., ORDER)' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "reference_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Notes' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "notes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Created by user ID' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "created_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Created at' }),
    __metadata("design:type", String)
], InventoryLogResponse.prototype, "created_at", void 0);
class InventoryDetailResponse extends InventoryListResponse {
    product;
}
exports.InventoryDetailResponse = InventoryDetailResponse;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Product details' }),
    __metadata("design:type", Object)
], InventoryDetailResponse.prototype, "product", void 0);
class UpdateInventoryRequest {
    qty_available;
    low_stock_threshold;
}
exports.UpdateInventoryRequest = UpdateInventoryRequest;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Available quantity', minimum: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateInventoryRequest.prototype, "qty_available", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Low stock threshold', minimum: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateInventoryRequest.prototype, "low_stock_threshold", void 0);
var TransactionType;
(function (TransactionType) {
    TransactionType["RESTOCK"] = "RESTOCK";
    TransactionType["SALE"] = "SALE";
    TransactionType["RESERVE"] = "RESERVE";
    TransactionType["RELEASE"] = "RELEASE";
    TransactionType["ADJUSTMENT"] = "ADJUSTMENT";
    TransactionType["DAMAGE"] = "DAMAGE";
    TransactionType["RETURN"] = "RETURN";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
class AdjustInventoryRequest {
    qty_change;
    transaction_type;
    notes;
}
exports.AdjustInventoryRequest = AdjustInventoryRequest;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Quantity change (positive or negative)' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AdjustInventoryRequest.prototype, "qty_change", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Transaction type',
        enum: TransactionType,
        example: TransactionType.ADJUSTMENT,
    }),
    (0, class_validator_1.IsEnum)(TransactionType),
    __metadata("design:type", String)
], AdjustInventoryRequest.prototype, "transaction_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Notes for the adjustment' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustInventoryRequest.prototype, "notes", void 0);
//# sourceMappingURL=inventory.dto.js.map