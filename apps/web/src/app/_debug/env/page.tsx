export default function EnvDebugPage() {
  return (
    <pre style={{ padding: 16 }}>
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
