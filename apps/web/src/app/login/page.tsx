import LoginClient from './LoginClient';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; registered?: string };
}) {
  const next = searchParams?.next ?? '/app';
  const registered = searchParams?.registered === '1';
  return <LoginClient next={next} registered={registered} />;
}
