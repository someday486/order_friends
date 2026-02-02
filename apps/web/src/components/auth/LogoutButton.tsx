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
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #ccc",
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
