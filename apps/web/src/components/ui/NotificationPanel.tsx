"use client";

import { useNotifications, type Notification } from "@/providers/NotificationProvider";
import { useRouter } from "next/navigation";

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const TYPE_ICONS: Record<string, string> = {
  LOW_STOCK: "📦",
  NEW_ORDER: "🛎",
  ORDER_STATUS: "📋",
};

const TYPE_COLORS: Record<string, string> = {
  LOW_STOCK: "bg-warning-500/10 text-warning-600",
  NEW_ORDER: "bg-primary-500/10 text-primary-500",
  ORDER_STATUS: "bg-secondary/10 text-secondary",
};

function NotificationItem({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const router = useRouter();
  const { markAsRead } = useNotifications();

  const handleClick = () => {
    markAsRead(notification.id);
    onClose();
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-3 hover:bg-bg-tertiary transition-colors border-b border-border last:border-b-0 ${
        notification.isRead ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${TYPE_COLORS[notification.type] || "bg-bg-tertiary"}`}
        >
          {TYPE_ICONS[notification.type] || "🔔"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {notification.title}
            </span>
            {!notification.isRead && (
              <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <span className="text-2xs text-text-tertiary mt-1 block">
            {formatTimeAgo(notification.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, unreadCount, markAllAsRead } = useNotifications();

  return (
    <div className="absolute right-0 top-full mt-2 w-[340px] max-h-[420px] bg-background border border-border rounded-xl shadow-2xl z-[60] overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">
          알림 {unreadCount > 0 && `(${unreadCount})`}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-2xs text-primary-500 font-medium hover:underline"
          >
            모두 읽음
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[360px]">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-text-tertiary text-sm">
            새로운 알림이 없습니다
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClose={onClose} />
          ))
        )}
      </div>
    </div>
  );
}
