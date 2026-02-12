"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "@/lib/api-client";

// ============================================================
// Types
// ============================================================

export type NotificationType = "LOW_STOCK" | "NEW_ORDER" | "ORDER_STATUS";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
};

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  refresh: () => void;
};

// ============================================================
// Context
// ============================================================

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  markAsRead: () => {},
  markAllAsRead: () => {},
  refresh: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

// ============================================================
// Provider
// ============================================================

const POLL_INTERVAL = 60_000; // 60초

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastOrderStatusRef = useRef<Record<string, string>>({});

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const alerts: Notification[] = [];
      const now = new Date();
      const tenMinutesAgo = now.getTime() - 10 * 60 * 1000;

      const branches = await apiClient
        .get<Array<{ id: string; name: string }>>("/customer/branches")
        .catch(() => []);

      await Promise.all(
        branches.map(async (branch) => {
          const inventory = await apiClient
            .get<
              Array<{
                product_id: string;
                product_name: string;
                branch_name?: string;
                qty_available: number;
                low_stock_threshold: number;
                is_low_stock: boolean;
              }>
            >(`/customer/inventory/alerts?branchId=${encodeURIComponent(branch.id)}`)
            .catch(() => []);

          for (const item of inventory) {
            if (!item.is_low_stock) continue;
            alerts.push({
              id: `low-stock-${branch.id}-${item.product_id}`,
              type: "LOW_STOCK",
              title: "재고 부족",
              message: `${item.product_name} (${item.branch_name || branch.name}) - 현재 ${item.qty_available}개 (최소 ${item.low_stock_threshold}개)`,
              isRead: false,
              createdAt: now.toISOString(),
              link: `/customer/inventory/${item.product_id}`,
            });
          }
        }),
      );

      const orderResponse = await apiClient
        .get<
          | Array<{
              id: string;
              orderNo?: string | null;
              order_no?: string | null;
              status: string;
              orderedAt?: string;
              created_at?: string;
              branchName?: string;
            }>
          | {
              data?: Array<{
                id: string;
                orderNo?: string | null;
                order_no?: string | null;
                status: string;
                orderedAt?: string;
                created_at?: string;
                branchName?: string;
              }>;
              items?: Array<{
                id: string;
                orderNo?: string | null;
                order_no?: string | null;
                status: string;
                orderedAt?: string;
                created_at?: string;
                branchName?: string;
              }>;
            }
        >("/customer/orders?page=1&limit=20")
        .catch(() => []);
      const orders = Array.isArray(orderResponse)
        ? orderResponse
        : orderResponse.data || orderResponse.items || [];

      const nextStatusMap: Record<string, string> = {};
      for (const order of orders) {
        const orderNo = order.orderNo || order.order_no || order.id.slice(0, 8);
        const createdAt = order.orderedAt || order.created_at || now.toISOString();
        const createdAtMs = new Date(createdAt).getTime();
        const branchText = order.branchName ? ` (${order.branchName})` : "";
        const prevStatus = lastOrderStatusRef.current[order.id];
        nextStatusMap[order.id] = order.status;

        if (createdAtMs >= tenMinutesAgo) {
          alerts.push({
            id: `new-order-${order.id}`,
            type: "NEW_ORDER",
            title: "신규 주문",
            message: `주문 #${orderNo}${branchText}이 접수되었습니다.`,
            isRead: false,
            createdAt,
            link: `/customer/orders/${order.id}`,
          });
        }

        if (prevStatus && prevStatus !== order.status) {
          alerts.push({
            id: `order-status-${order.id}-${order.status}`,
            type: "ORDER_STATUS",
            title: "주문 상태 변경",
            message: `주문 #${orderNo} 상태가 ${order.status}(으)로 변경되었습니다.`,
            isRead: false,
            createdAt: now.toISOString(),
            link: `/customer/orders/${order.id}`,
          });
        }
      }
      lastOrderStatusRef.current = nextStatusMap;

      setNotifications((prev) => {
        const readIds = new Set(
          prev.filter((n) => n.isRead).map((n) => n.id),
        );
        return alerts
          .map((a) => ({
            ...a,
            isRead: readIds.has(a.id),
          }))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
      });
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refresh: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
