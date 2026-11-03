import { redirect } from 'next/navigation';
/** During the Paddle cutover, no browser return proves payment. */
export default function PendingPaymentPage() { redirect('/billing/verification'); }
