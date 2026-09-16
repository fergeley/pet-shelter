import { SponsorshipReconciliation } from "@/components/admin/SponsorshipReconciliation";

/**
 * Reconciliation may wait for another coordinator's row lock, and its receipt
 * email is registered with `after()`. Next applies this page-level budget to
 * every Server Action invoked here, giving both operations explicit headroom.
 */
export const maxDuration = 30;

export default function AdminDonationsPage() {
  return <SponsorshipReconciliation />;
}
