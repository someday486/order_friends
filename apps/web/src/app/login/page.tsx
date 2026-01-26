"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    setMsg(null);

    const supabase = createClient();

    try {
      // 1️⃣ 이메일 로그인
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(`로그인 실패: ${error.message}`);
        setLoading(false);
        return;
      }

      // 2️⃣ 세션에서 access_token 가져오기
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      console.log("ACCESS_TOKEN EXISTS?", !!token);
      console.log("API BASE:", process.env.NEXT_PUBLIC_API_BASE_URL);

      if (!token) {
        setMsg("로그인 성공했지만 access_token을 가져오지 못했습니다.");
        setLoading(false);
        return;
      }

      // 3️⃣ Nest API 호출
      let res: Response;
      try {
        res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/orders`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      } catch (e) {
        console.error("Fetch failed:", e);
        setMsg("로그인 성공 / API 서버 연결 실패");
        setLoading(false);
        return;
      }

      let body: any = null;
      try {
        body = await res.json();
      } catch {}

      console.log("ORDERS API RESULT:", res.status, body);

      if (res.status === 200) {
        setMsg("로그인 성공 + 주문 API 호출 성공");
      } else if (res.status === 401) {
        setMsg("로그인 성공 / 백엔드 인증 실패 (401)");
      } else if (res.status === 403) {
        setMsg("로그인 성공 / 권한 없음 (RLS 403)");
      } else {
        setMsg(`로그인 성공 / API 에러 (${res.status})`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h2>로그인</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={onLogin} disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
