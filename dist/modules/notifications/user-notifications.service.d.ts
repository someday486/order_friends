import { SupabaseService } from '../../infra/supabase/supabase.service';
import { UserNotificationResponse } from './dto/user-notification.dto';
export declare class UserNotificationsService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    getNotifications(userId: string, limit?: number, offset?: number): Promise<{
        notifications: UserNotificationResponse[];
        unreadCount: number;
    }>;
    markAsRead(userId: string, notificationId: string): Promise<void>;
    markAllAsRead(userId: string): Promise<{
        updated: number;
    }>;
    createNotification(userId: string, type: string, title: string, message?: string, link?: string, metadata?: Record<string, any>): Promise<UserNotificationResponse>;
}
