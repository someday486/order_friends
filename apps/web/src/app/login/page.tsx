import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';

function isPublicOrderTrackingPath(value: string) {
  return value.startsWith('/order/track/');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; registered?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const next = resolvedSearchParams?.next ?? '/app';
  const registered = resolvedSearchParams?.registered === '1';

  if (isPublicOrderTrackingPath(next)) {
    redirect(next);
  }

  return <LoginClient next={next} registered={registered} />;
}
