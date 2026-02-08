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
var CustomerOrdersController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerOrdersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const customer_guard_1 = require("../../common/guards/customer.guard");
const customer_orders_service_1 = require("./customer-orders.service");
const update_order_status_request_1 = require("../../modules/orders/dto/update-order-status.request");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const order_status_enum_1 = require("../../modules/orders/order-status.enum");
let CustomerOrdersController = CustomerOrdersController_1 = class CustomerOrdersController {
    ordersService;
    logger = new common_1.Logger(CustomerOrdersController_1.name);
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    async getOrders(req, branchId, status, paginationDto) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} fetching orders${branchId ? ` for branch ${branchId}` : ' (all branches)'}`);
        return this.ordersService.getMyOrders(req.user.id, branchId, req.brandMemberships || [], req.branchMemberships || [], paginationDto, status);
    }
    async getOrder(req, orderId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} fetching order ${orderId}`);
        return this.ordersService.getMyOrder(req.user.id, orderId, req.brandMemberships || [], req.branchMemberships || []);
    }
    async updateOrderStatus(req, orderId, body) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} updating order ${orderId} status to ${body.status}`);
        return this.ordersService.updateMyOrderStatus(req.user.id, orderId, body.status, req.brandMemberships || [], req.branchMemberships || []);
    }
};
exports.CustomerOrdersController = CustomerOrdersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '내 지점의 주문 목록 조회',
        description: '내가 멤버로 등록된 지점의 주문 목록을 조회합니다. (페이지네이션 지원)',
    }),
    (0, swagger_1.ApiQuery)({ name: 'branchId', description: '지점 ID', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'status', description: '주문 상태 필터', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', description: '페이지 번호', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', description: '페이지당 항목 수', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '주문 목록 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: '잘못된 요청' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], CustomerOrdersController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Get)(':orderId'),
    (0, swagger_1.ApiOperation)({
        summary: '내 주문 상세 조회',
        description: '내가 멤버로 등록된 지점의 주문 상세 정보를 조회합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: '주문 ID 또는 주문 번호' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '주문 상세 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '주문을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CustomerOrdersController.prototype, "getOrder", null);
__decorate([
    (0, common_1.Patch)(':orderId/status'),
    (0, swagger_1.ApiOperation)({
        summary: '주문 상태 변경',
        description: '내가 OWNER 또는 ADMIN 권한을 가진 지점의 주문 상태를 변경합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: '주문 ID 또는 주문 번호' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '주문 상태 변경 성공' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: '권한 없음' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '주문을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_order_status_request_1.UpdateOrderStatusRequest]),
    __metadata("design:returntype", Promise)
], CustomerOrdersController.prototype, "updateOrderStatus", null);
exports.CustomerOrdersController = CustomerOrdersController = CustomerOrdersController_1 = __decorate([
    (0, swagger_1.ApiTags)('customer-orders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/orders'),
    __metadata("design:paramtypes", [customer_orders_service_1.CustomerOrdersService])
], CustomerOrdersController);
//# sourceMappingURL=customer-orders.controller.js.map