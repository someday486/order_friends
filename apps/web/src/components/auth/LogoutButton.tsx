"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    if (loading) return;
    setLoading(true);

    try {
      await supabaseBrowser.auth.signOut();

      // ✅ refresh 호출 금지
      router.replace("/login");
      router.refresh(); // (선택) 라우트 캐시 초기화용
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
