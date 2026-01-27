"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Home() {
  const [msg, setMsg] = useState("checking...");

  useEffect(() => {
    const run = async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      setMsg(data.session ? "logged in" : "not logged in");
    };
    run();
  }, []);

  return <div>{msg}</div>;
}
