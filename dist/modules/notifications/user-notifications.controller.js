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
var UserNotificationsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserNotificationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/guards/auth.guard");
const customer_guard_1 = require("../../common/guards/customer.guard");
const user_notifications_service_1 = require("./user-notifications.service");
const user_notification_dto_1 = require("./dto/user-notification.dto");
let UserNotificationsController = UserNotificationsController_1 = class UserNotificationsController {
    notificationsService;
    logger = new common_1.Logger(UserNotificationsController_1.name);
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    async getNotifications(req, limit, offset) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} fetching notifications`);
        return this.notificationsService.getNotifications(req.user.id, limit ? parseInt(limit, 10) : 50, offset ? parseInt(offset, 10) : 0);
    }
    async markAllAsRead(req) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} marking all notifications as read`);
        return this.notificationsService.markAllAsRead(req.user.id);
    }
    async markAsRead(req, notificationId) {
        if (!req.user)
            throw new Error('Missing user');
        this.logger.log(`User ${req.user.id} marking notification ${notificationId} as read`);
        await this.notificationsService.markAsRead(req.user.id, notificationId);
        return { success: true };
    }
};
exports.UserNotificationsController = UserNotificationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: '알림 목록 조회',
        description: '내 알림 목록을 조회합니다.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        description: '조회 개수 (기본 50)',
        required: false,
    }),
    (0, swagger_1.ApiQuery)({
        name: 'offset',
        description: '시작 위치 (기본 0)',
        required: false,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: '알림 목록 조회 성공',
        type: [user_notification_dto_1.UserNotificationResponse],
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], UserNotificationsController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Patch)('read-all'),
    (0, swagger_1.ApiOperation)({
        summary: '모든 알림 읽음 처리',
        description: '모든 읽지 않은 알림을 읽음 상태로 변경합니다.',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '전체 읽음 처리 성공' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserNotificationsController.prototype, "markAllAsRead", null);
__decorate([
    (0, common_1.Patch)(':notificationId/read'),
    (0, swagger_1.ApiOperation)({
        summary: '알림 읽음 처리',
        description: '특정 알림을 읽음 상태로 변경합니다.',
    }),
    (0, swagger_1.ApiParam)({ name: 'notificationId', description: '알림 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '알림 읽음 처리 성공' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '알림을 찾을 수 없음' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('notificationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], UserNotificationsController.prototype, "markAsRead", null);
exports.UserNotificationsController = UserNotificationsController = UserNotificationsController_1 = __decorate([
    (0, swagger_1.ApiTags)('customer-notifications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, customer_guard_1.CustomerGuard),
    (0, common_1.Controller)('customer/notifications'),
    __metadata("design:paramtypes", [user_notifications_service_1.UserNotificationsService])
], UserNotificationsController);
//# sourceMappingURL=user-notifications.controller.js.map