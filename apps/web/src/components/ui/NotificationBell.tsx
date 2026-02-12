"use client";

import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/providers/NotificationProvider";
import { BellIcon } from "@/components/ui/icons";
import { NotificationPanel } from "./NotificationPanel";

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
        aria-label={`알림 ${unreadCount > 0 ? `${unreadCount}개 읽지 않음` : ""}`}
      >
        <BellIcon size={20} className="text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold flex items-center justify-center leading-none animate-pulse-slow">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
}
