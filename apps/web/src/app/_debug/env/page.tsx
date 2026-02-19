import { notFound } from "next/navigation";

export default function EnvDebugPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <pre className="p-4 text-foreground">
      {JSON.stringify(
        {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY_EXISTS: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
        },
        null,
        2,
      )}
    </pre>
  );
}
