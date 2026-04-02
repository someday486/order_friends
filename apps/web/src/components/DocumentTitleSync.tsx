'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const APP_NAME = '오더프렌즈';

type RouteTitleRule = {
  title: string;
  match: (pathname: string) => boolean;
};

const routeTitleRules: RouteTitleRule[] = [
  { title: '메인', match: (pathname) => pathname === '/' },
  { title: '로그인', match: (pathname) => pathname === '/login' },
  { title: '회원가입', match: (pathname) => pathname === '/signup' },
  {
    title: '승인 대기',
    match: (pathname) => pathname === '/approval-pending',
  },
  { title: '관리자 홈', match: (pathname) => pathname === '/admin' },
  {
    title: '권한 관리',
    match: (pathname) => pathname === '/admin/members',
  },
  {
    title: '브랜드 관리',
    match: (pathname) => pathname === '/admin/brand',
  },
  {
    title: '매장 관리',
    match: (pathname) => pathname === '/admin/stores',
  },
  {
    title: '매장 상세',
    match: (pathname) => pathname.startsWith('/admin/stores/'),
  },
  {
    title: '상품 관리',
    match: (pathname) => pathname === '/admin/products',
  },
  {
    title: '상품 상세',
    match: (pathname) => pathname.startsWith('/admin/products/'),
  },
  {
    title: '주문 관리',
    match: (pathname) => pathname === '/admin/orders',
  },
  {
    title: '주문 상세',
    match: (pathname) => pathname.startsWith('/admin/orders/'),
  },
  {
    title: '주문 페이지',
    match: (pathname) => pathname === '/admin/order',
  },
  { title: '고객 홈', match: (pathname) => pathname === '/customer' },
  {
    title: '대시보드',
    match: (pathname) =>
      pathname === '/customer/analytics' ||
      pathname === '/customer/analytics/brand',
  },
  {
    title: '브랜드 관리',
    match: (pathname) => pathname === '/customer/brands',
  },
  {
    title: '브랜드 상세',
    match: (pathname) => pathname.startsWith('/customer/brands/'),
  },
  {
    title: '매장 관리',
    match: (pathname) => pathname === '/customer/branches',
  },
  {
    title: '매장 상세',
    match: (pathname) => pathname.startsWith('/customer/branches/'),
  },
  {
    title: '권한 관리',
    match: (pathname) => pathname === '/customer/permissions',
  },
  {
    title: '카테고리 관리',
    match: (pathname) => pathname === '/customer/categories',
  },
  {
    title: '상품 관리',
    match: (pathname) => pathname === '/customer/products',
  },
  {
    title: '상품 상세',
    match: (pathname) => pathname.startsWith('/customer/products/'),
  },
  {
    title: '재고 관리',
    match: (pathname) => pathname === '/customer/inventory',
  },
  {
    title: '재고 상세',
    match: (pathname) => pathname.startsWith('/customer/inventory/'),
  },
  {
    title: '주문 관리',
    match: (pathname) => pathname === '/customer/orders',
  },
  {
    title: '주문 상세',
    match: (pathname) => pathname.startsWith('/customer/orders/'),
  },
  {
    title: '주문 페이지',
    match: (pathname) => pathname === '/customer/order',
  },
  {
    title: '마이페이지',
    match: (pathname) => pathname === '/customer/mypage',
  },
  {
    title: '브랜드 둘러보기',
    match: (pathname) => pathname === '/shop',
  },
  {
    title: '브랜드 주문',
    match: (pathname) => pathname.startsWith('/shop/'),
  },
  {
    title: '주문 조회',
    match: (pathname) => pathname.startsWith('/order/track/'),
  },
  {
    title: '브랜드 주문',
    match: (pathname) =>
      /^\/order\/[^/]+$/.test(pathname) && !pathname.startsWith('/order/track/'),
  },
  {
    title: '주문하기',
    match: (pathname) =>
      /^\/order\/[^/]+\/[^/]+$/.test(pathname) &&
      !pathname.endsWith('/checkout'),
  },
  {
    title: '결제하기',
    match: (pathname) =>
      /^\/order\/[^/]+\/[^/]+\/checkout$/.test(pathname),
  },
  {
    title: '주문하기',
    match: (pathname) =>
      /^\/order\/branch\/[^/]+$/.test(pathname) &&
      !pathname.endsWith('/checkout'),
  },
  {
    title: '결제하기',
    match: (pathname) => /^\/order\/branch\/[^/]+\/checkout$/.test(pathname),
  },
];

function getDocumentTitle(pathname: string | null): string {
  if (!pathname) {
    return APP_NAME;
  }

  const isDynamicOrderPage =
    /^\/order\/[^/]+\/[^/]+$/.test(pathname) ||
    /^\/order\/branch\/[^/]+$/.test(pathname);

  if (isDynamicOrderPage) {
    return document.title;
  }

  const matchedRule = routeTitleRules.find((rule) => rule.match(pathname));
  if (!matchedRule) {
    return APP_NAME;
  }

  return `${matchedRule.title} | ${APP_NAME}`;
}

export function DocumentTitleSync() {
  const pathname = usePathname();

  useEffect(() => {
    document.title = getDocumentTitle(pathname);
  }, [pathname]);

  return null;
}
