# Target — `/api/upload` stores nothing in any configuration

> **Scope**: the three `StorageProvider` implementations in `src/lib/storage/index.ts`. Two of the
> three never write the file anywhere and return success; the third writes to a filesystem that does
> not persist on the deploy target. `/api/upload` therefore has no working production path.
>
> **Status**: 🟡 unstarted. Audited 2026-09-03 against `origin/master` `d24aedf`, file blob
> `2e4ad1f`. Found while diagnosing a Vercel build failure in the same route.

---

## 1. What is actually there

`getStorageProvider()` (`src/lib/storage/index.ts:181`) picks one of three by `STORAGE_PROVIDER`,
defaulting to local. All three are reachable; none of them store a file on Vercel.

| Provider | `uploadFile` behaviour | Result for the caller |
|---|---|---|
| `LocalStorageProvider` (`:35`) | `mkdir` + `writeFile` under `process.cwd()/public/uploads` | Throws on Vercel — the function filesystem is read-only outside `/tmp`, and ephemeral |
| `S3StorageProvider` (`:99`) | Builds a URL string. **No upload of any kind.** | `200` with `provider: "s3"` and a URL that 404s forever |
| `CloudinaryStorageProvider` (`:147`) | Builds a `res.cloudinary.com` URL. **No upload.** | Same |

`deleteFile` on both cloud providers (`:119`, `:165`) is `return true` with the argument voided — it
reports success without deleting anything.

The comment at `:106` states the opposite of what the code does:

```ts
// In production with AWS SDK credentials, this performs S3 PutObject.
const url = this.getFileUrl(sanitizedFilename);
```

There is no `PutObject`. **`package.json` declares no storage SDK at all** — no `@aws-sdk/*`, no
`cloudinary`, no `@vercel/blob` — so no code path in this repository is capable of performing the
upload the comment describes.

## 2. Why this is worse than it looks

The default (`local`) fails **loudly**: an EROFS from `writeFile` propagates and the admin sees an
error. Setting `STORAGE_PROVIDER=s3` to "fix" that converts a visible failure into a silent one —
the route returns `200`, the URL is recorded against the pet, and the broken image is discovered
later by the public rather than immediately by the admin who uploaded it.

So the configuration change an operator would reach for first is the one that does the most damage.
Anyone reading §1 should not set `STORAGE_PROVIDER` until a provider actually uploads.

**Blast radius is bounded**: `/api/upload` is admin-only behind `verifyAdminSession()`, so this is a
broken admin feature and a set of dead image URLs, not an exposure. No data is at risk; pet photos
simply never exist.

## 3. The decision this needs

Not "implement S3" — pick the target first, because the choice removes rather than adds code:

1. **`@vercel/blob`** — recommended. The app already deploys on Vercel, the token is provisioned by
   the platform, and it deletes the whole endpoint/region/CDN-URL surface that
   `S3StorageProvider` carries in its constructor for portability it has never actually exercised.
2. **Real S3 via `@aws-sdk/client-s3`** — keeps the existing shape and the R2/Supabase/MinIO
   portability the class comment claims. Costs a dependency and credential handling.
3. **Cloudinary** — only if image transformation is wanted; the current URL shape already assumes
   `.webp` conversion that nothing performs.

Whichever is chosen, **delete the other two rather than leaving them as stubs**. A provider that
returns success without doing the work is worse than an absent one, and this file is where that
lesson was learned.

## 4. Traps

- `getFileUrl()` is used by `uploadFile` to fabricate the return URL. Once a real upload exists, the
  URL must come from the upload response, not be reconstructed — the two disagree the moment the
  provider adds a content hash, a version segment, or a folder prefix.
- `LocalStorageProvider` must stay working for local development and the test suite; the zero-setup
  property is deliberate (`TARGET_SECRET_HARDENING.md` §2 makes the same argument for secrets). The
  fix is to make the *cloud* path real, not to delete the local one.
- Filename sanitisation differs between `uploadFile` (strips to `[a-zA-Z0-9._-]`) and `getFileUrl`
  (`basename` only). Any real implementation must use one function for both or the stored key and
  the served URL will diverge for a filename containing a space.
- There is no collision handling. Two uploads named `photo.jpg` resolve to the same key and the
  second silently replaces the first.

## 5. Definition of done

- One provider genuinely uploads, verified by fetching the returned URL and getting the bytes back.
- `deleteFile` genuinely deletes, or the interface drops it.
- The unimplemented providers are removed, not left returning success.
- A test asserts that a provider's returned URL is the one the store issued, rather than one the
  test also reconstructs — reconstructing it in the test reproduces the bug being fixed.
- `.env.example` documents whichever variables the surviving provider actually reads.
