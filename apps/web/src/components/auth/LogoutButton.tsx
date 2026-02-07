"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    if (loading) return;

    setLoading(true);
    try {
      await supabaseBrowser.auth.signOut();

      // ✅ 로그아웃 직후 상태 동기화
      await refresh();

      window.location.assign("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onLogout}
      disabled={loading}
      className="py-2 px-3 rounded border border-border bg-transparent text-foreground cursor-pointer hover:bg-bg-tertiary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
