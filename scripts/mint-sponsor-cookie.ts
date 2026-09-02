/**
 * Mints a signed sponsor session cookie for manual testing of the tier gates.
 *
 * Usage: npx tsx scripts/mint-sponsor-cookie.ts gold
 *
 * The demo sponsors only exist when `NODE_ENV !== "production"`, so this is useless
 * against a production build — which is the point.
 */
import { sealSponsorSession } from "../src/lib/security/sponsorSession";

const SPONSORS = {
  bronze: { sponsorId: "spn-bronze-01", email: "bronze@example.com", name: "Nurul Aisyah" },
  silver: { sponsorId: "spn-silver-01", email: "silver@example.com", name: "Jason Lim" },
  gold: {
    sponsorId: "spn-gold-01",
    email: "gold@example.com",
    name: "Datin Sofia Rahman",
  },
} as const;

const tier = (process.argv[2] || "gold").toLowerCase() as keyof typeof SPONSORS;
const sponsor = SPONSORS[tier];

if (!sponsor) {
  console.error(`Unknown tier '${tier}'. Expected one of: ${Object.keys(SPONSORS).join(", ")}`);
  process.exit(1);
}

console.log(sealSponsorSession(sponsor));
