# 실시간 알림 시스템

## 개요

Supabase Realtime과 데이터베이스 트리거를 활용한 실시간 알림 시스템입니다.

## 아키텍처

```
주문 생성/변경 → PostgreSQL Trigger → notifications 테이블
                                              ↓
                                    Supabase Realtime
                                              ↓
                                         프론트엔드
```

## 데이터베이스 설정

### 1. Notifications 테이블 (이미 존재)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. 주문 상태 변경 트리거

```sql
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 주문을 생성한 사용자가 있다면 알림 생성
  IF NEW.status != OLD.status THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.created_by,
      'order_status_changed',
      '주문 상태 변경',
      '주문 #' || NEW.order_no || '의 상태가 ' || NEW.status || '로 변경되었습니다.',
      jsonb_build_object(
        'order_id', NEW.id,
        'order_no', NEW.order_no,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_status_change_notification
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change();
```

### 3. 재고 부족 알림 트리거

```sql
CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qty_available <= NEW.low_stock_threshold AND
     OLD.qty_available > OLD.low_stock_threshold THEN

    -- 브랜드 관리자들에게 알림
    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT
      bm.user_id,
      'low_stock',
      '재고 부족 알림',
      '상품의 재고가 부족합니다.',
      jsonb_build_object(
        'product_id', NEW.product_id,
        'branch_id', NEW.branch_id,
        'qty_available', NEW.qty_available,
        'threshold', NEW.low_stock_threshold
      )
    FROM brand_members bm
    JOIN branches b ON b.brand_id = bm.brand_id
    WHERE b.id = NEW.branch_id
      AND bm.role IN ('OWNER', 'ADMIN')
      AND bm.status = 'ACTIVE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER low_stock_notification
  AFTER UPDATE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION notify_low_stock();
```

## 프론트엔드 구현

### React Hook 예시

```typescript
// hooks/useRealtimeNotifications.ts
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

export function useRealtimeNotifications(userId: string) {
  const [notifications, setNotifications] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    // 초기 알림 로드
    const loadNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) setNotifications(data);
    };

    loadNotifications();

    // 실시간 구독
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);

          // 브라우저 알림
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(payload.new.title, {
              body: payload.new.message,
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  return { notifications, markAsRead };
}
```

### 사용 예시

```typescript
// components/NotificationBell.tsx
function NotificationBell() {
  const { user } = useAuth();
  const { notifications, markAsRead } = useRealtimeNotifications(user?.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button className="relative">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs">
            {unreadCount}
          </span>
        )}
      </button>

      <div className="notification-dropdown">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            onClick={() => markAsRead(notification.id)}
            className={notification.read ? 'opacity-50' : ''}
          >
            <h4>{notification.title}</h4>
            <p>{notification.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 알림 타입

현재 지원하는 알림 타입:

- `order_created` - 새 주문 생성
- `order_status_changed` - 주문 상태 변경
- `low_stock` - 재고 부족
- `payment_completed` - 결제 완료
- `member_invited` - 멤버 초대
- `branch_created` - 새 지점 생성

## API 엔드포인트

### GET /notifications

사용자의 알림 목록 조회

```typescript
@Get()
async getNotifications(@Req() req: AuthRequest, @Query('unreadOnly') unreadOnly?: boolean) {
  return this.notificationsService.getUserNotifications(
    req.user.id,
    unreadOnly === 'true'
  );
}
```

### PATCH /notifications/:id/read

알림 읽음 처리

```typescript
@Patch(':id/read')
async markAsRead(@Param('id') id: string, @Req() req: AuthRequest) {
  return this.notificationsService.markAsRead(id, req.user.id);
}
```

### DELETE /notifications/:id

알림 삭제

```typescript
@Delete(':id')
async deleteNotification(@Param('id') id: string, @Req() req: AuthRequest) {
  return this.notificationsService.deleteNotification(id, req.user.id);
}
```

## 브라우저 알림 권한 요청

```typescript
// utils/notifications.ts
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}
```

## 성능 최적화

### 1. 알림 배치 로딩

```typescript
const { data } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .range(0, 19); // 한 번에 20개만
```

### 2. 구독 필터링

```typescript
// 특정 브랜치의 알림만 구독
.filter(`data->branch_id=eq.${branchId}`)
```

### 3. 알림 만료

```sql
-- 30일 이상 된 읽은 알림 자동 삭제
DELETE FROM notifications
WHERE read = TRUE
  AND created_at < NOW() - INTERVAL '30 days';
```

## 향후 개선 사항

1. **푸시 알림**: Firebase Cloud Messaging 통합
2. **이메일 알림**: SendGrid/AWS SES 통합
3. **SMS 알림**: Twilio 통합
4. **알림 설정**: 사용자별 알림 선호도 관리
5. **알림 그룹화**: 동일 타입 알림 묶기
