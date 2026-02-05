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
exports.OrderSearchDto = exports.ProductSearchDto = exports.SearchDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class SearchDto {
    q;
    sortBy;
    sortOrder;
    page = 1;
    limit = 20;
}
exports.SearchDto = SearchDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '검색어', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SearchDto.prototype, "q", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '정렬 필드', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SearchDto.prototype, "sortBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: '정렬 방향',
        enum: ['asc', 'desc'],
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['asc', 'desc']),
    __metadata("design:type", String)
], SearchDto.prototype, "sortOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '페이지 번호', required: false, default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SearchDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '페이지 크기', required: false, default: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SearchDto.prototype, "limit", void 0);
class ProductSearchDto extends SearchDto {
    category;
    minPrice;
    maxPrice;
    inStock;
    brandId;
}
exports.ProductSearchDto = ProductSearchDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '카테고리 필터', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProductSearchDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '최소 가격', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProductSearchDto.prototype, "minPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '최대 가격', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ProductSearchDto.prototype, "maxPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '재고 있는 상품만', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], ProductSearchDto.prototype, "inStock", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '브랜드 ID', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProductSearchDto.prototype, "brandId", void 0);
class OrderSearchDto extends SearchDto {
    status;
    startDate;
    endDate;
    customerName;
    minAmount;
    maxAmount;
}
exports.OrderSearchDto = OrderSearchDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '주문 상태 필터', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderSearchDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '시작 날짜 (YYYY-MM-DD)', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderSearchDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '종료 날짜 (YYYY-MM-DD)', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderSearchDto.prototype, "endDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '고객명 검색', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrderSearchDto.prototype, "customerName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '최소 금액', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OrderSearchDto.prototype, "minAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '최대 금액', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OrderSearchDto.prototype, "maxAmount", void 0);
//# sourceMappingURL=search.dto.js.map