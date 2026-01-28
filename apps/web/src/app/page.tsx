"use client";

import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <div>checking...</div>;
  }

  if (status === "unauthenticated") {
    return <div>not logged in</div>;
  }

  return <div>logged in as {user?.email}</div>;
}
