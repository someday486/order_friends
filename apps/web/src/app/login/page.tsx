import LoginClient from "./LoginClient";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = searchParams?.next ?? "/app";
  return <LoginClient next={next} />;
}