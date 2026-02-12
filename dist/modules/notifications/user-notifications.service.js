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
var UserNotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserNotificationsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../infra/supabase/supabase.service");
let UserNotificationsService = UserNotificationsService_1 = class UserNotificationsService {
    supabase;
    logger = new common_1.Logger(UserNotificationsService_1.name);
    constructor(supabase) {
        this.supabase = supabase;
    }
    async getNotifications(userId, limit = 50, offset = 0) {
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('user_notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) {
            this.logger.error(`Failed to fetch notifications for user ${userId}`, error);
            throw new Error('Failed to fetch notifications');
        }
        const { count, error: countError } = await sb
            .from('user_notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);
        if (countError) {
            this.logger.error(`Failed to count unread notifications`, countError);
        }
        return {
            notifications: data || [],
            unreadCount: count || 0,
        };
    }
    async markAsRead(userId, notificationId) {
        const sb = this.supabase.adminClient();
        const { error } = await sb
            .from('user_notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', userId);
        if (error) {
            this.logger.error(`Failed to mark notification ${notificationId} as read`, error);
            throw new common_1.NotFoundException('Notification not found');
        }
    }
    async markAllAsRead(userId) {
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('user_notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('is_read', false)
            .select('id');
        if (error) {
            this.logger.error(`Failed to mark all notifications as read for user ${userId}`, error);
            throw new Error('Failed to mark all as read');
        }
        return { updated: data?.length || 0 };
    }
    async createNotification(userId, type, title, message, link, metadata) {
        const sb = this.supabase.adminClient();
        const { data, error } = await sb
            .from('user_notifications')
            .insert({
            user_id: userId,
            type,
            title,
            message,
            link,
            metadata: metadata || {},
        })
            .select()
            .single();
        if (error) {
            this.logger.error(`Failed to create notification for user ${userId}`, error);
            throw new Error('Failed to create notification');
        }
        return data;
    }
};
exports.UserNotificationsService = UserNotificationsService;
exports.UserNotificationsService = UserNotificationsService = UserNotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], UserNotificationsService);
//# sourceMappingURL=user-notifications.service.js.map