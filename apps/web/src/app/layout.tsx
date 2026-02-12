import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--color-bg-secondary)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#34C759", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#FF3B30", secondary: "#fff" },
            },
          }}
        />
      </body>
    </html>
  );
}
