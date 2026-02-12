import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { UserNotificationResponse } from './dto/user-notification.dto';

@Injectable()
export class UserNotificationsService {
  private readonly logger = new Logger(UserNotificationsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get user's notifications (most recent first)
   */
  async getNotifications(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{
    notifications: UserNotificationResponse[];
    unreadCount: number;
  }> {
    const sb = this.supabase.adminClient();

    // Fetch notifications
    const { data, error } = await sb
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(
        `Failed to fetch notifications for user ${userId}`,
        error,
      );
      throw new Error('Failed to fetch notifications');
    }

    // Get unread count
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

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const sb = this.supabase.adminClient();

    const { error } = await sb
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `Failed to mark notification ${notificationId} as read`,
        error,
      );
      throw new NotFoundException('Notification not found');
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const sb = this.supabase.adminClient();

    const { data, error } = await sb
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      this.logger.error(
        `Failed to mark all notifications as read for user ${userId}`,
        error,
      );
      throw new Error('Failed to mark all as read');
    }

    return { updated: data?.length || 0 };
  }

  /**
   * Create a notification for a user (internal use)
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message?: string,
    link?: string,
    metadata?: Record<string, any>,
  ): Promise<UserNotificationResponse> {
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
      this.logger.error(
        `Failed to create notification for user ${userId}`,
        error,
      );
      throw new Error('Failed to create notification');
    }

    return data;
  }
}
