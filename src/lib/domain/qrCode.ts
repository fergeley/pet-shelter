import qrcode from "qrcode-generator";

/**
 * Donation QR code domain logic.
 *
 * Two independent sources feed the public donation surfaces:
 *   1. An uploaded QR image (PNG / JPEG / WebP) stored via `/api/upload`.
 *   2. A payment payload string (a DuitNow EMVCo string or a bank deep link)
 *      that we render to an SVG QR ourselves.
 *
 * Everything here is pure and runs identically on the server and the client so
 * the admin preview and the public modal cannot drift apart.
 */

/**
 * Upload MIME types accepted for a QR image.
 *
 * SVG is deliberately excluded. An SVG served from our own origin under
 * `/uploads/` can carry inline <script>, which would be stored XSS. Admins who
 * only have an SVG QR should paste its payload into the auto-generate field
 * instead — we then emit an SVG we constructed ourselves.
 */
export const QR_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Max UTF-8 bytes accepted in an auto-generate payload (QR version 40 / level M). */
export const QR_PAYLOAD_MAX_LENGTH = 1200;

/**
 * Accepts a same-origin upload path or an absolute http/https URL, and nothing else.
 *
 * The codebase's previous `z.string().url()` on `Pet.image` had this backwards:
 * it rejected the `/uploads/...` path our uploader actually returns and
 * accepted `javascript:`. Blocking script-bearing schemes is the point here.
 *
 * `http:` is permitted deliberately. `S3StorageProvider.getFileUrl` builds URLs
 * from the admin-set `s3CdnUrl` or `AWS_S3_ENDPOINT`, and a self-hosted MinIO
 * endpoint is conventionally `http://minio:9000`; rejecting it would make
 * `/api/upload` succeed and then the save fail validation. Serving an image over
 * http from an https page is a mixed-content warning, not a script execution
 * risk — prefer https where the deployment allows it.
 */
export function isSafeImageUrl(value: string): boolean {
  const url = value.trim();
  if (url === "") return false;

  // Same-origin path. Reject protocol-relative `//evil.example` and traversal.
  if (url.startsWith("/")) {
    return !url.startsWith("//") && !url.includes("..") && url.length > 1;
  }

  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * As `isSafeImageUrl`, but a same-origin value must live under `/uploads/`.
 *
 * A donation QR is only ever an admin upload or a hosted image; there is no
 * reason for one to point at an arbitrary same-origin path, and narrowing it
 * keeps the field from being pointed at unrelated app routes.
 */
export function isSafeQrImageUrl(value: string): boolean {
  const url = value.trim();
  if (!isSafeImageUrl(url)) return false;
  if (!url.startsWith("/")) return true;
  return url.startsWith("/uploads/") && url.length > "/uploads/".length;
}

export interface RenderQrOptions {
  /** Pixel size of one QR module in the emitted viewBox. Default 4. */
  cellSize?: number;
  /** Quiet-zone width in modules. ISO/IEC 18004 requires at least 4. */
  margin?: number;
  /** Foreground colour. Keep this dark for scanner contrast. */
  foreground?: string;
  /** Background colour. Must stay opaque — a transparent QR will not scan. */
  background?: string;
  /** Accessible label rendered as <title>. */
  title?: string;
}

const SVG_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeSvgText(value: string): string {
  return value.replace(/[&<>"]/g, (char) => SVG_ESCAPES[char]);
}

/**
 * Re-expresses a string so each character is one UTF-8 byte.
 *
 * `qrcode-generator`'s default byte encoder is `charCodeAt(i) & 0xff`, which
 * silently truncates anything outside Latin-1: an em dash (U+2014) encodes as
 * byte 0x14. It does not throw — it emits a perfectly scannable QR carrying a
 * corrupted payload, which for a payment string means money routed nowhere.
 * The package does ship a UTF-8 encoder, but its `exports` map does not expose
 * that subpath, so we pre-encode instead. Feeding the library bytes it will
 * pass through unchanged makes the emitted QR true UTF-8.
 */
function toLatin1Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

/** Length of `value` once UTF-8 encoded — what QR capacity is actually measured in. */
export function qrPayloadByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Rejects anything that is not a plain hex/rgb()/named colour token. */
function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$/.test(value.trim()) ? value.trim() : fallback;
}

/**
 * Renders `payload` as a standalone SVG QR code (ISO/IEC 18004, error
 * correction level M — the level PayNet specifies for DuitNow).
 *
 * The SVG is assembled from the module matrix rather than the library's
 * `createSvgTag`, so every character of the output is ours and no caller value
 * reaches the markup unescaped.
 */
export function renderQrSvg(payload: string, options: RenderQrOptions = {}): string {
  const data = payload.trim();
  if (data === "") {
    throw new Error("Cannot render a QR code from an empty payload.");
  }
  // Measured in encoded bytes, not UTF-16 units: QR capacity is a byte budget,
  // and a multi-byte character costs more than one.
  const byteLength = qrPayloadByteLength(data);
  if (byteLength > QR_PAYLOAD_MAX_LENGTH) {
    throw new Error(
      `Payload is ${byteLength} bytes; the maximum is ${QR_PAYLOAD_MAX_LENGTH}.`
    );
  }

  const cellSize = Math.max(1, Math.round(options.cellSize ?? 4));
  const margin = Math.max(4, Math.round(options.margin ?? 4));
  const foreground = safeColor(options.foreground ?? "#18181b", "#18181b");
  const background = safeColor(options.background ?? "#ffffff", "#ffffff");

  // typeNumber 0 lets the library pick the smallest version that fits.
  const qr = qrcode(0, "M");
  qr.addData(toLatin1Utf8(data));
  qr.make();

  const count = qr.getModuleCount();
  const size = (count + margin * 2) * cellSize;

  // Emit one horizontal run per group of adjacent dark modules instead of one
  // <rect> per module. A version-10 code drops from ~1,900 rects to ~250.
  const runs: string[] = [];
  for (let row = 0; row < count; row++) {
    let runStart = -1;
    for (let col = 0; col <= count; col++) {
      const dark = col < count && qr.isDark(row, col);
      if (dark && runStart === -1) {
        runStart = col;
      } else if (!dark && runStart !== -1) {
        const x = (runStart + margin) * cellSize;
        const y = (row + margin) * cellSize;
        const width = (col - runStart) * cellSize;
        runs.push(`<rect x="${x}" y="${y}" width="${width}" height="${cellSize}"/>`);
        runStart = -1;
      }
    }
  }

  const title = options.title ? `<title>${escapeSvgText(options.title)}</title>` : "";
  const role = options.title ? 'role="img"' : 'role="img" aria-label="QR code"';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `width="${size}" height="${size}" shape-rendering="crispEdges" ${role}>` +
    title +
    `<rect width="${size}" height="${size}" fill="${background}"/>` +
    `<g fill="${foreground}">${runs.join("")}</g>` +
    `</svg>`
  );
}

export interface DonationQrSources {
  /** `Pet.customQrUrl` when the donation surface is scoped to one animal. */
  petCustomQrUrl?: string | null;
  /** The pet's name, used for the caption on a per-animal drive. */
  petName?: string | null;
  /** `ShelterSettings.duitNowQrUrl` / `tngQrUrl` / `bankQrUrl`. */
  shelterQrUrl?: string | null;
  /** `ShelterSettings.paymentPayload`. */
  paymentPayload?: string | null;
  /** `ShelterSettings.shelterName`, used for the caption under the code. */
  shelterName?: string | null;
}

/** Shelter-level values published to the client tree by `DonationQrProvider`. */
export interface ShelterQrConfigLike {
  duitNowQrUrl: string;
  paymentPayload: string;
  shelterName: string;
}

/**
 * Merges explicitly-passed sources over the shelter-wide config.
 *
 * The distinction between `undefined` and `""` carries meaning and must be
 * preserved by every caller:
 *
 *   undefined -> "I have no opinion" — fall back to the shelter config.
 *   ""        -> "explicitly cleared" — show it as cleared.
 *
 * The admin settings preview depends on the second case, so an admin who clears
 * the QR sees the cleared state rather than the stored value. The pet dialog
 * depends on the first, so previewing an animal with no dedicated QR shows the
 * shelter code the donor would really get. Coercing `undefined` to `""` on the
 * way in collapses the two and makes the pet preview always show the
 * placeholder — do not do it.
 */
export function mergeQrSources(
  props: DonationQrSources,
  config: ShelterQrConfigLike
): DonationQrSources {
  return {
    petCustomQrUrl: props.petCustomQrUrl,
    petName: props.petName,
    shelterQrUrl: props.shelterQrUrl ?? config.duitNowQrUrl,
    paymentPayload: props.paymentPayload ?? config.paymentPayload,
    shelterName: props.shelterName ?? config.shelterName,
  };
}

export type DonationQrResolution =
  | { kind: "pet-image"; imageUrl: string; caption: string; isPetSpecific: true }
  | { kind: "shelter-image"; imageUrl: string; caption: string; isPetSpecific: false }
  | { kind: "generated"; svg: string; caption: string; isPetSpecific: false }
  | { kind: "placeholder"; caption: string; isPetSpecific: false };

/**
 * Picks which QR a public donation surface should show.
 *
 * Precedence: this animal's dedicated fund-drive QR, then the shelter's
 * uploaded QR, then one generated from the shelter payment payload, then the
 * decorative placeholder. Unsafe or unrenderable values fall through to the
 * next source rather than throwing at render time.
 */
export function resolveDonationQr(sources: DonationQrSources): DonationQrResolution {
  // Falls back only when the caller has no shelterName to offer.
  const shelterCaption = (sources.shelterName ?? "").trim() || "Hope for Strays Shelter Selangor";

  const petUrl = (sources.petCustomQrUrl ?? "").trim();
  if (petUrl !== "" && isSafeQrImageUrl(petUrl)) {
    const name = (sources.petName ?? "").trim();
    return {
      kind: "pet-image",
      imageUrl: petUrl,
      caption: name === "" ? `${shelterCaption} — Medical Fund` : `${name} — Medical Fund Drive`,
      isPetSpecific: true,
    };
  }

  const shelterUrl = (sources.shelterQrUrl ?? "").trim();
  if (shelterUrl !== "" && isSafeQrImageUrl(shelterUrl)) {
    return {
      kind: "shelter-image",
      imageUrl: shelterUrl,
      caption: shelterCaption,
      isPetSpecific: false,
    };
  }

  const payload = (sources.paymentPayload ?? "").trim();
  if (payload !== "") {
    try {
      return {
        kind: "generated",
        svg: renderQrSvg(payload, { title: `DuitNow QR for ${shelterCaption}` }),
        caption: shelterCaption,
        isPetSpecific: false,
      };
    } catch {
      // Payload too long or unencodable — fall through to the placeholder.
    }
  }

  return { kind: "placeholder", caption: shelterCaption, isPetSpecific: false };
}
