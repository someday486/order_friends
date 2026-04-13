import { redirect } from 'next/navigation';

export default function BusinessPaymentsRedirectPage() {
  redirect('/customer/payments');
}
