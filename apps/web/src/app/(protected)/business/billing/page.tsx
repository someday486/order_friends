import { redirect } from 'next/navigation';

export default function BusinessBillingRedirectPage() {
  redirect('/customer/billing');
}
