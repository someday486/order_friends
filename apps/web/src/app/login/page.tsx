import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';

function isPublicOrderTrackingPath(value: string) {
  return value.startsWith('/order/track/');
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; registered?: string };
}) {
  const next = searchParams?.next ?? '/app';
  const registered = searchParams?.registered === '1';

  if (isPublicOrderTrackingPath(next)) {
    redirect(next);
  }

  return <LoginClient next={next} registered={registered} />;
}
