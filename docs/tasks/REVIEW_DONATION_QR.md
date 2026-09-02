# Review record: admin-managed donation QR codes

Closes the QR work stream. Section 1 is what the original request asserted versus
what was true. Section 2 is the defects found reviewing my own implementation.
Section 3 is what is still open.

Verified against the running code and the live Neon database on 2026-09-02/03.
Re-verify before building on any of it — [[target-doc-baselines-go-stale]] is a
recurring failure here.

---

## 1. Assertions in the original request that were false

The request specified a feature against a codebase it described inaccurately.
Each of these was checked before any code was written.

| Claim | Reality |
| --- | --- |
| Restrict writes to `SUPER_ADMIN` / `ANIMAL_MANAGER` | Neither role exists. The `Role` enum is `ADMIN \| COORDINATOR \| STAFF \| VOLUNTEER`, in `schema.prisma` and in the live database. Zero hits repo-wide. |
| Extend `ShelterSettings` to persist QR URLs | `ShelterSettings` was never read or written through Prisma. `prisma.shelterSettings` appeared nowhere; settings lived in a module-level `let` and a `localStorage` mirror. Adding columns alone would have changed nothing. |
| Per-pet field goes in `src/app/admin/pets` | That page is 21 lines. The dialog is `src/components/admin/PetFormDialog.tsx`. |
| Support uploading PNG, JPG, **SVG** | `/api/upload` allows JPEG/PNG/WebP/GIF with magic-byte checks. SVG was and remains excluded: an SVG served from our own origin under `/uploads/` can carry inline `<script>`. |
| Use a library like `qrcode` | Not installed, and it pulls `yargs` — a CLI framework — into the server bundle. Used `qrcode-generator` (zero dependencies, same ISO/IEC 18004 standard). |

### Hazards the request did not mention

- **`prisma db push` would have destroyed data.** Production carried
  `Pet.rehabProgressPercent`, `Pet.rehabStage`, `Pet.rehabStageMs` and the
  `medical_timeline_events` / `pet_updates` tables, none declared in the schema
  file. See `docs/runbooks/RUNBOOK_PRISMA_DATABASE_SETUP.md`, Procedure A2.
- **The placeholder QR SVG was duplicated verbatim** in `DonationWidget` and
  `SponsorshipModal` — the same seventeen hand-placed `<rect>` elements. Wiring a
  real QR into one would have left the other showing a decorative fake.
- **`petFormSchema` used `z.string().url()`**, which rejects the `/uploads/...`
  paths the uploader returns and accepts `javascript:`. Saving a pet after
  uploading its photo was already broken.

---

## 2. Defects found reviewing the implementation

Ordered by severity. All fixed; each has a regression test.

### 2.1 An unauthenticated server action returned the Resend API key

`loadShelterSettings` was added to fix a *different* bug — the settings form
seeding from `localStorage` and blanking saved QR codes. It shipped with no
session check and returned the entire settings object.

A server action is a POST endpoint whose id ships in the client bundle. The same
module already redacted `resendApiKey` before it reached `audit_logs`, and the
write action immediately below it called `assertAuthorized`.

**Why it was possible:** the security reflex fires on writes. This was framed as
a read helper, so it never got the review a mutation would have.

### 2.2 A save that never persisted reported success

`writeShelterSettings` returns `persisted: false` when Postgres is unreachable.
The action threaded that into the audit details and then dropped it, returning
`success: true`. The admin saw a green confirmation while donors kept scanning
the old code and the upload died with the process. A *failed* save was worse
still: `onSubmit` ignored `res.success === false` entirely.

**Why it was possible:** the fallback was designed deliberately and then not
carried to the surface that reports outcomes. Graceful degradation that is
invisible is indistinguishable from success.

### 2.3 `?? ""` collapsed "absent" into "cleared"

`DonationQrPanel` distinguishes them: `undefined` falls back to the shelter
config, `""` means the admin cleared the field. `QrPreviewDialog` normalised its
own props with `?? ""` before passing them down, so the pet form's donor preview
always rendered the placeholder while the real sponsorship modal showed the
shelter QR. The one surface built to show admins where donations go reported the
opposite of what shipped.

**Fix shape:** the merge is now `mergeQrSources`, a pure function with both cases
unit-tested, rather than an expression buried in a hook.

### 2.4 The QR encoder silently corrupted non-ASCII payloads

`qrcode-generator`'s default byte mode is `charCodeAt(i) & 0xff`. An em dash
(U+2014) encodes as byte `0x14`. It does not throw — it emits a perfectly
scannable QR carrying a corrupted payment string.

Confirmed directly rather than reasoned about:

```
lib bytes: 17   utf-8 bytes: 21   match: false
'—' (8212) -> 20
```

The package ships a UTF-8 encoder but its `exports` map does not expose that
subpath, so the payload is pre-encoded to UTF-8 bytes. The length cap now
measures encoded bytes; QR capacity is a byte budget, not a character count.

**Why it matters here:** the artifact looks correct. A scannable QR that resolves
to the wrong account is worse than one that fails to render.

### 2.5 Tightening a validator broke an unrelated, working path

Narrowing `Pet.image` to https-or-`/uploads` rejected the `http://` URLs
`S3StorageProvider.getFileUrl` legitimately builds from `s3CdnUrl` or
`AWS_S3_ENDPOINT` — a self-hosted MinIO endpoint is conventionally
`http://minio:9000`. Upload would succeed and the save would then fail
validation.

Split into `isSafeImageUrl` (photos: any same-origin path, http, https) and
`isSafeQrImageUrl` (QR: `/uploads/` or hosted). Both still block `javascript:`,
`data:` and protocol-relative URLs, which was the actual security goal.

### 2.6 The money-routing audit read from mock data

`updateServerPet` takes its `before` from `serverPets`, seeded from
`src/data/pets.json`, which has no `customQrUrl`. On any cold start the entry
claimed the QR changed from nothing, and a genuine swap made on another instance
was invisible. The previous value is now read from Postgres.

### 2.7 A security policy module with no callers

`qrAccess.ts` defined `canEditGlobalQr` / `canEditPetQr`. The settings page
re-implemented the check inline. Nothing imported the module except its own
tests, which asserted the role sets and reported the control as covered.

**Why it was possible:** extracting a policy feels like enforcing it. It is not.

### 2.8 Smaller

- Turning the auto-generate switch off hid the textarea but kept submitting,
  storing and publishing the payload.
- The server-hydration effect could `reset()` the whole form mid-typing.
- `resolveDonationQr` ran unmemoized in a client render body, re-encoding on every
  keystroke of the pledge form; `PetFormDialog` mounted the preview dialog
  unconditionally.
- `DEFAULT_SHELTER_SETTINGS` duplicated `settingsStore`'s defaults and the two had
  already diverged on `operatingHours` — in the same commit that added a lessons
  entry titled "anything written twice diverges".
- `QR_CHANNELS`, `QR_CHANNEL_LABELS`, `normalizeQrImageUrl` and `renderQrDataUri`
  had no importer outside tests.
- The donor caption hard-coded the shelter name instead of using the
  `shelterName` setting this feature made persistent.

---

## 3. Closed since the review

### Touch 'n Go and bank QR codes now reach donors

They were persisted, validated and uploadable for a whole release while
`DonationQrPanel` rendered only `duitNowQrUrl`. The admin field descriptions
said so, but the upload control was fully live and the image landed in
Postgres, so an admin could reasonably believe donors could pay that way.

`availableQrChannels` now drives a switcher on the donor panel. DuitNow is
always offered because it owns the full fallback chain (uploaded image, then a
code generated from the payment payload, then the placeholder); the other two
appear only once an image is uploaded for them. A shelter that configures
DuitNow alone gets `["duitnow"]`, no switcher, and pixel-identical output to
before — pinned by a test.

Two details worth keeping:

- The payment payload is a DuitNow EMVCo string, so `mergeQrSources` refuses to
  lend it to another rail. Generating a code from it under a Touch 'n Go tab
  would show the wrong rail's QR.
- Channel accents are applied inline rather than as Tailwind classes. Tailwind
  cannot build a class name from a variable, so `border-[${accent}]` would
  silently produce no style at all.

### `getAdminPets` is no longer a public endpoint

It was an export of a `"use server"` module with no session check, returning
archived animals and per-pet application counts to anyone who sent its action
id. Gating it in place was not an option: its only caller is the `/admin/pets`
server component, which Next prerenders at build time with no session, so an
authorization throw would have broken the build.

The logic moved to `src/lib/domain/adminPetCatalog.ts`, a plain function the
page imports directly — same data path, no endpoint. The `KNOWN GAP` entry that
held it in the `serverActionAuth` allowlist is gone, and that guard's
"no stale names" assertion now proves the action no longer exists.

## 3b. Still open

- **A CI build with no reachable `DATABASE_URL` bakes the placeholder** into
  every prerendered page. `getDonationQrConfig` catches and returns empty
  strings, and nothing distinguishes "no QR configured" from "could not reach
  the database". `revalidatePath("/", "layout")` on the next settings save
  repairs it.
- ~~`schema.prisma` does not declare the drifted rehab objects.~~ **Resolved.**
  The TNRM branch landed (PR #2) and `master` now declares `rehabStage`,
  `rehabStageMs` and `rehabProgressPercent` along with the `PetUpdate` and
  `MedicalTimelineEvent` models. The QR columns were applied to production
  ahead of that merge and are declared here, so schema and database agree
  again. Keep running `db pull --print` before any schema work regardless.
- **`updateServerPet` still resolves the pet through the in-memory array**, so a
  record present only in Postgres cannot be updated. Pre-existing, and wider than
  this feature.

## 4. Wisdom

Durable rules, recorded here and in `tasks/lessons.md`.

1. **Making a field persist can turn a harmless bug destructive.** The settings
   form seeding from `localStorage` was survivable while nothing persisted. The
   moment the QR fields reached real columns, a second admin's save would blank
   them. When you make a field persist, audit every path that *seeds* the form —
   a previously write-only field has no loading path, and the absence is
   invisible until it deletes something.
2. **Apply additive migrations before merging the code that declares them.**
   Prisma selects every declared column. Additive nullable columns are invisible
   to older code, so migrating first is free and closes the window where reads
   fall back to seed data.
3. **Every exported `"use server"` function is a public POST endpoint.** Gate
   reads, not just writes, and project the response to the fields the caller
   needs rather than returning an internal object.
4. **"It rendered" is not evidence of correctness** when the failure mode is a
   valid-looking artifact carrying wrong data. Test encoders with non-ASCII input.
5. **A security helper with only test importers is worse than none** — it
   produces green coverage for a rule nothing enforces. After extracting a
   policy, grep for its callers.
6. **De-duplication must be pixel-neutral or it is two changes.** The two copies
   of the QR markup differed in `shadow-xs` vs `shadow-sm` and `mb-2.5` vs `mb-2`;
   collapsing them quietly restyled `/donate`.
7. **Verify the claim, not the claimant.** Every finding above was checked against
   running code or the live database before being acted on. The encoder bug and
   the `http://` regression both required running something, not reading it.
