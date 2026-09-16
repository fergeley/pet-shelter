import { SponsorshipReconciliation } from "@/components/admin/SponsorshipReconciliation";

/**
 * One receipt attempt may spend 5 seconds acquiring the transaction and 15 seconds
 * inside it, and the scoped unique-race recovery permits one retry. Next applies
 * this page-level budget to every Server Action invoked here and to its `after()`
 * work. Sixty seconds therefore leaves 20 seconds beyond the 40-second transaction
 * ceiling for authorization, recovery reads, and best-effort email scheduling;
 * those operations have no separate latency bound.
 */
export const maxDuration = 60;

export default function AdminDonationsPage() {
  return <SponsorshipReconciliation />;
}
