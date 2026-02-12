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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const orders_service_1 = require("./orders.service");
const auth_guard_1 = require("../../common/guards/auth.guard");
const admin_guard_1 = require("../../common/guards/admin.guard");
const update_order_status_request_1 = require("./dto/update-order-status.request");
const get_orders_query_dto_1 = require("./dto/get-orders-query.dto");
let OrdersController = class OrdersController {
    ordersService;
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    async getOrders(req, query) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        return this.ordersService.getOrders(req.accessToken, query.branchId, query);
    }
    async getOrder(orderId, req, branchId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        return this.ordersService.getOrder(req.accessToken, orderId, branchId);
    }
    async updateOrderStatus(orderId, body, req, branchId) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        if (!branchId) {
            throw new common_1.BadRequestException('branchId is required');
        }
        return this.ordersService.updateStatus(req.accessToken, orderId, body.status, branchId);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '주문 목록 조회',
        description: '지점의 주문 목록을 조회합니다. (페이지네이션 지원)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '주문 목록 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, get_orders_query_dto_1.GetOrdersQueryDto]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Get)(':orderId'),
    (0, swagger_1.ApiOperation)({
        summary: '주문 상세 조회',
        description: '특정 주문의 상세 정보를 조회합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: '주문 ID 또는 주문 번호' }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '주문 상세 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '주문을 찾을 수 없음' }),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getOrder", null);
__decorate([
    (0, common_1.Patch)(':orderId/status'),
    (0, swagger_1.ApiOperation)({
        summary: '주문 상태 변경',
        description: '주문의 상태를 변경합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: '주문 ID 또는 주문 번호' }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '주문 상태 변경 성공' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '주문을 찾을 수 없음' }),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_order_status_request_1.UpdateOrderStatusRequest, Object, String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateOrderStatus", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)('orders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, admin_guard_1.AdminGuard),
    (0, common_1.Controller)('admin/orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map