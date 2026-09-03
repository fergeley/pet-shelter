# Donation QR codes

> How this feature works is below. **Why it looks the way it does** — the
> assertions in the original request that turned out to be false, the defects
> found reviewing the first implementation, and what is still open — is in
> [`docs/tasks/REVIEW_DONATION_QR.md`](tasks/REVIEW_DONATION_QR.md).

Malaysian donors pay through DuitNow QR, Touch 'n Go eWallet, and direct bank
transfer. Admins manage those codes shelter-wide, and optionally per animal for
a dedicated medical fund drive.

## Where things live

| Concern | File |
| --- | --- |
| Encoding, URL safety, source precedence | `src/lib/domain/qrCode.ts` |
| Settings persistence + audit diffing | `src/lib/domain/shelterSettings.ts` |
| Who may write which scope | `src/lib/security/qrAccess.ts` |
| Shared image-location validators | `src/lib/validations/qrImage.ts` |
| Admin upload control | `src/components/admin/QrImageUpload.tsx` |
| Admin settings tab | `src/components/admin/DonationQrSettings.tsx` |
| Donor preview modal | `src/components/admin/QrPreviewDialog.tsx` |
| Public panel (single copy) | `src/components/features/donations/DonationQrPanel.tsx` |
| Config published to the client tree | `src/components/providers/DonationQrProvider.tsx` |

## Which QR a donor sees

`resolveDonationQr` picks, in order:

1. `Pet.customQrUrl` — this animal's dedicated fund drive.
2. `ShelterSettings.duitNowQrUrl` — the shelter's uploaded image.
3. `ShelterSettings.paymentPayload` — rendered to SVG by `renderQrSvg`.
4. A decorative placeholder, labelled as a sample so it cannot be mistaken for a
   live code.

A value that fails `isSafeQrImageUrl` falls through to the next source rather
than throwing at render time.

## Migrate BEFORE merging, not after

Prisma selects every declared column, so the generated client and the live table
must agree. Verified against the live database on 2026-09-02, with the columns
still missing:

```
prisma.pet.findMany()            -> The column `pets.customQrUrl` does not exist
prisma.shelterSettings.find...() -> The column `shelter_settings.duitNowQrUrl` does not exist
```

`getServerPetsAsync` catches that and falls back to the in-memory seed array, so
the site keeps rendering while silently serving eight seed pets instead of real
data; `insertServerPet` and `updateServerPet` catch it too and only `console.warn`,
so a pet appears to save and does not persist.

The columns are nullable and additive, which means the pre-merge code cannot see
them and is completely unaffected by their existence. Running the migration
first therefore has no downside and closes the window entirely.

## Applying the database columns

`prisma/schema.prisma` gained five nullable columns. **Do not run
`prisma db push`.** Live Postgres has drifted ahead of the schema file — it
carries `Pet.rehabProgressPercent`, `Pet.rehabStage`, `Pet.rehabStageMs` and the
`medical_timeline_events` / `pet_updates` tables, which belong to an unlanded
branch and are not declared here. A push generated from this schema would drop
all of them.

Apply the additive migration instead:

```bash
npx prisma db execute \
  --file prisma/sql/2026-09-02-donation-qr-columns.sql \
  --schema prisma/schema.prisma
```

Every statement is `ADD COLUMN IF NOT EXISTS` on a nullable, default-free
column, so Postgres only updates the catalog: no table rewrite, no row lock.
The rollback statements are commented at the bottom of that file.

Until the migration runs, `writeShelterSettings` returns `persisted: false` and
the values live only in the server's memory — they will not survive a restart,
and on a serverless deploy each instance holds its own copy.

## Payment channels

`availableQrChannels` decides which rails a donor is offered. DuitNow is always
present because it owns the fallback chain; `tngQrUrl` and `bankQrUrl` add a tab
each, but only once an image is uploaded for them. A shelter with only a DuitNow
code therefore renders exactly as it did before channels existed — no switcher.

The payment payload is a DuitNow EMVCo string and is never lent to another rail.
Channel accent colours are applied inline: Tailwind cannot build a class name
from a variable, so `border-[${accent}]` would produce no style at all.

## Deliberate deviations from the original request

- **Roles.** The request named `SUPER_ADMIN` and `ANIMAL_MANAGER`. Neither
  exists; the `Role` enum is `ADMIN | COORDINATOR | STAFF | VOLUNTEER` in both
  the schema and the live database. See `src/lib/security/qrAccess.ts` for the
  mapping and why the two scopes have different role sets.
- **SVG uploads are rejected.** An SVG served from our own origin under
  `/uploads/` can carry an inline `<script>`, which would be stored XSS. Admins
  with an SVG-only code should paste its payload into the auto-generate field;
  we then emit an SVG we constructed ourselves.
- **QR uploads skip image optimization.** `ImageUpload` re-encodes to lossy WebP
  at quality 0.85 and downscales to 1600px. That softens the module edges a
  scanner thresholds on, so `QrImageUpload` uploads the selected bytes unchanged.
- **`qrcode-generator`, not `qrcode`.** The `qrcode` package pulls `yargs`, a
  CLI framework, into the server bundle. `qrcode-generator` has zero
  dependencies and implements the same ISO/IEC 18004 standard.

## Cache invalidation

The QR config is read in the root layout, and most routes prerender as static.
`updateShelterSettings` therefore calls `revalidatePath("/", "layout")`, which
invalidates the root layout and every page beneath it — including the SSG
`/pets/[id]` pages. Invalidating individual paths would leave a stale QR on any
route not explicitly listed.

## Audit records

Two entries are written on a settings save:

- `SETTINGS_UPDATED` — the whole before/after, with `resendApiKey` redacted.
- `DONATION_QR_UPDATED` — only when a QR field actually changed, carrying a
  narrow before/after of the four QR keys.

A per-animal change writes `DONATION_QR_UPDATED` with `targetEntity: "Pet"` from
`updateServerPet`. Both carry `actorEmail` and `actorRole`.

Audit rows are readable by every admin and are immutable, so a credential
captured there cannot be rotated out of the history — hence the redaction in
`redactSettingsForAudit`.

## Tests

- `tests/unit/donationQr.test.ts` — URL safety, SVG rendering (including a check
  that the emitted rects reproduce the encoder's module matrix exactly), and
  source precedence.
- `tests/unit/shelterSettingsQr.test.ts` — column mapping, null handling, the
  offline fallback, schema validation, and the role sets.
- `tests/unit/donationQrAudit.test.ts` — the audit entries, secret redaction, and
  the authorization checks on `updateShelterSettings`.
