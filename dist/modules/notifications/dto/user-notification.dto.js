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
exports.UserNotificationResponse = void 0;
const swagger_1 = require("@nestjs/swagger");
class UserNotificationResponse {
    id;
    type;
    title;
    message;
    link;
    is_read;
    metadata;
    created_at;
    read_at;
}
exports.UserNotificationResponse = UserNotificationResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Notification ID' }),
    __metadata("design:type", String)
], UserNotificationResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Notification type (LOW_STOCK, ORDER_UPDATE, INFO, etc.)',
    }),
    __metadata("design:type", String)
], UserNotificationResponse.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Notification title' }),
    __metadata("design:type", String)
], UserNotificationResponse.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Notification message body' }),
    __metadata("design:type", String)
], UserNotificationResponse.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Link to navigate to' }),
    __metadata("design:type", String)
], UserNotificationResponse.prototype, "link", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Whether the notification has been read' }),
    __metadata("design:type", Boolean)
], UserNotificationResponse.prototype, "is_read", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Additional metadata' }),
    __metadata("design:type", Object)
], UserNotificationResponse.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Created at' }),
    __metadata("design:type", String)
], UserNotificationResponse.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Read at' }),
    __metadata("design:type", String)
], UserNotificationResponse.prototype, "read_at", void 0);
//# sourceMappingURL=user-notification.dto.js.map