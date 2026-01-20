"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export default function Home() {
  const [msg, setMsg] = useState("checking...");

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      setMsg(data.session ? "logged in" : "not logged in");
    };
    run();
  }, []);

  return <div>{msg}</div>;
}
