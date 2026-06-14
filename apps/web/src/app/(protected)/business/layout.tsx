'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Boxes } from 'lucide-react';

export default function BusinessLayout() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-secondary p-6 text-center text-foreground">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-tertiary text-text-secondary">
          <Boxes size={22} />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">
          Online Market Operations
        </p>
        <h1 className="mt-3 text-xl font-extrabold">
          고객 운영센터로 이동하고 있습니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          대량 발주와 입고 중심 화면은 검토가 끝날 때까지 노출하지 않습니다.
          현재 오더프렌즈 운영은 브랜드, 스토어/출고지, 상품, 주문, 결제,
          정산을 다루는 고객 운영센터에서 계속 진행합니다.
        </p>
        <Link
          href="/customer"
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-bold text-white no-underline transition-colors hover:bg-primary-600"
        >
          고객 운영센터로 이동
        </Link>
      </div>
    </div>
  );
}
