"use client";

import { LogoutButton } from "@/components/auth/LogoutButton";

export default function AppPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Protected App Area</h1>

      <div style={{ marginTop: 16 }}>
        <LogoutButton />
      </div>
    </div>
  );
}