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
exports.CustomerDashboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const customer_guard_1 = require("../../common/guards/customer.guard");
const customer_dashboard_service_1 = require("./customer-dashboard.service");
let CustomerDashboardController = class CustomerDashboardController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    async getDashboardStats(req) {
        if (!req.accessToken)
            throw new Error('Missing access token');
        if (!req.user)
            throw new Error('Missing user');
        return this.dashboardService.getDashboardStats(req.user.id, req.brandMemberships || [], req.branchMemberships || []);
    }
};
exports.CustomerDashboardController = CustomerDashboardController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '고객 대시보드 통계 조회',
        description: '고객(브랜드 오너)의 전체 통계를 조회합니다. 본인이 소유한 브랜드/매장의 통계만 조회됩니다.',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '대시보드 통계 조회 성공' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: '인증 실패' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerDashboardController.prototype, "getDashboardStats", null);
exports.CustomerDashboardController = CustomerDashboardController = __decorate([
    (0, swagger_1.ApiTags)('customer-dashboard'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/dashboard'),
    __metadata("design:paramtypes", [customer_dashboard_service_1.CustomerDashboardService])
], CustomerDashboardController);
//# sourceMappingURL=customer-dashboard.controller.js.map