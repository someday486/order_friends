"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [msg, setMsg] = useState("checking...");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return setMsg(`Supabase error: ${error.message}`);

      setUserId(data.session?.user.id ?? null);
      setMsg("Supabase connected ✅");
    })();
  }, []);

  const loginKakao = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "kakao" });
    if (error) setMsg(`Login error: ${error.message}`);
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setMsg(`Logout error: ${error.message}`);
  };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>OrderFriends</h1>
      <p>{msg}</p>

      <div style={{ marginTop: 16 }}>
        {userId ? (
          <>
            <p>Logged in user: {userId}</p>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <button onClick={loginKakao}>Login with Kakao</button>
        )}
      </div>
    </main>
  );
}
