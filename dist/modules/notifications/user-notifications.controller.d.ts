import type { AuthRequest } from '../../common/types/auth-request';
import { UserNotificationsService } from './user-notifications.service';
import { UserNotificationResponse } from './dto/user-notification.dto';
export declare class UserNotificationsController {
    private readonly notificationsService;
    private readonly logger;
    constructor(notificationsService: UserNotificationsService);
    getNotifications(req: AuthRequest, limit?: string, offset?: string): Promise<{
        notifications: UserNotificationResponse[];
        unreadCount: number;
    }>;
    markAllAsRead(req: AuthRequest): Promise<{
        updated: number;
    }>;
    markAsRead(req: AuthRequest, notificationId: string): Promise<{
        success: boolean;
    }>;
}
