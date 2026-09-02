/**
 * Official donation receipt numbers, in the form `HFS-DON-YYYYMM-NNNNNN`.
 *
 * The shape is fixed by how it is used: a donor quotes this number to the shelter over
 * the phone, and it appears on an LHDN tax receipt. So it stays short and numeric — an
 * opaque UUID would be correct and unusable.
 *
 * Previously generated in two places (`actions/donations.ts` and `lib/sponsorshipStore.ts`)
 * from `Math.random()` over four digits. Two problems came with making the number the
 * `@unique` key that the sponsor account-claim challenge depends on:
 *
 *  - 9,000 values per month collide. By the birthday bound a duplicate is more likely
 *    than not once a month passes roughly 112 receipts, and a duplicate is rejected by
 *    the database, which means a donation that never reaches the ledger.
 *  - `Math.random()` is predictable, and the number is now a possession credential.
 *
 * Six digits keeps it quotable and takes the space to 900,000; `getRandomValues` makes it
 * unguessable. This makes collisions unlikely, not impossible — genuine uniqueness needs
 * a database sequence, which is what the receipt work in `donationLedger.ts` on the TNRM
 * branch is for. Do not build a second sequence here.
 */

const RECEIPT_DIGITS = 6;
const RECEIPT_MIN = 10 ** (RECEIPT_DIGITS - 1); // 100000
const RECEIPT_RANGE = 9 * RECEIPT_MIN; // 900000

/** Matches both the current six-digit numbers and the four-digit ones issued before. */
export const RECEIPT_NUMBER_PATTERN = /^HFS-DON-\d{6}-\d{4,6}$/;

/**
 * The shelter's timezone. The receipt's month segment has to agree with the date printed
 * beside it, which is formatted `en-MY` — and Malaysia is UTC+8, so a donation made in the
 * first eight hours of a month is still in the previous month by UTC. On a tax receipt
 * that straddles a period boundary, those two disagreeing is a real problem.
 */
const SHELTER_TIME_ZONE = "Asia/Kuala_Lumpur";

function shelterYearMonth(now: Date): string {
  // en-CA gives ISO-ordered YYYY-MM-DD, which makes the slice unambiguous.
  const localDate = now.toLocaleDateString("en-CA", { timeZone: SHELTER_TIME_ZONE });
  return localDate.slice(0, 7).replace("-", "");
}

/**
 * Cryptographically random sequence, using the Web Crypto API so the same function works
 * in a Server Action and in the client-side offline receipt fallback.
 *
 * Rejection-sampled rather than `% RECEIPT_RANGE`: 2^32 is not a multiple of 900,000, so
 * plain modulo would bias the low end of the range and weaken the unguessability this
 * module depends on.
 */
function randomSequence(): number {
  const limit = Math.floor(0x1_0000_0000 / RECEIPT_RANGE) * RECEIPT_RANGE;
  const buffer = new Uint32Array(1);

  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);

  return RECEIPT_MIN + (buffer[0] % RECEIPT_RANGE);
}

export function generateReceiptNumber(now: Date = new Date()): string {
  return `HFS-DON-${shelterYearMonth(now)}-${randomSequence()}`;
}
