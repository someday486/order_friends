"use client";

import { LogoutButton } from "@/components/auth/LogoutButton";

export default function AppPage() {
  return (
    <div className="p-6">
      <h1 className="text-foreground">Protected App Area</h1>

      <div className="mt-4">
        <LogoutButton />
      </div>
    </div>
  );
}