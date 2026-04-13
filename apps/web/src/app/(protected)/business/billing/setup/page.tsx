import { redirect } from 'next/navigation';

type BillingSetupSearchParams = Record<
  string,
  string | string[] | undefined
>;

export default async function BusinessBillingSetupRedirectPage({
  searchParams,
}: {
  searchParams: Promise<BillingSetupSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextSearchParams = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry) {
          nextSearchParams.append(key, entry);
        }
      });
      return;
    }

    if (value) {
      nextSearchParams.set(key, value);
    }
  });

  const queryString = nextSearchParams.toString();
  redirect(
    queryString
      ? `/customer/billing/setup?${queryString}`
      : '/customer/billing/setup',
  );
}
