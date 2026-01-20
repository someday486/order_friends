"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const sendOtp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // OTP든 MagicLink든 callback은 여기로 돌아옴
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (error) return alert(error.message);
    setStep("otp");
  };

  const verifyOtp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setLoading(false);

    if (error) return alert(error.message);
    router.replace("/dashboard");
  };

  return (
    <div style={{ maxWidth: 360 }}>
      <h1>로그인</h1>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        type="email"
        style={{ width: "100%", marginTop: 12 }}
      />

      {step === "email" && (
        <button onClick={sendOtp} disabled={loading || !email}>
          {loading ? "전송중..." : "인증코드 보내기"}
        </button>
      )}

      {step === "otp" && (
        <>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6자리 코드"
            inputMode="numeric"
            style={{ width: "100%", marginTop: 12 }}
          />
          <button onClick={verifyOtp} disabled={loading || otp.length < 6}>
            {loading ? "확인중..." : "로그인"}
          </button>
        </>
      )}
    </div>
  );
}
