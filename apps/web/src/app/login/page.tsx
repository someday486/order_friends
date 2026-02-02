import LoginClient from "./LoginClient";

type SearchParams = {
  next?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const next = sanitizeNext(sp?.next);

  return <LoginClient next={next} />;
}

function sanitizeNext(next?: string) {
  if (!next) return "/app";

  const decoded = decodeURIComponent(next);

  // 외부 URL / 프로토콜 차단 (open redirect 방지)
  if (decoded.startsWith("http://") || decoded.startsWith("https://")) return "/app";
  if (!decoded.startsWith("/")) return "/app";

  return decoded;
}
