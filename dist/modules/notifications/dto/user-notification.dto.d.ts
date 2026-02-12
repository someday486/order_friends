export declare class UserNotificationResponse {
    id: string;
    type: string;
    title: string;
    message?: string;
    link?: string;
    is_read: boolean;
    metadata?: Record<string, any>;
    created_at: string;
    read_at?: string;
}
