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

/** Channels a shelter-level QR can belong to. */
export type QrChannel = "duitnow" | "tng" | "bank";

export const QR_CHANNELS: readonly QrChannel[] = ["duitnow", "tng", "bank"];

export const QR_CHANNEL_LABELS: Record<QrChannel, string> = {
  duitnow: "DuitNow QR",
  tng: "Touch 'n Go eWallet",
  bank: "Bank Transfer QR",
};

/**
 * Upload MIME types accepted for a QR image.
 *
 * SVG is deliberately excluded. An SVG served from our own origin under
 * `/uploads/` can carry inline <script>, which would be stored XSS. Admins who
 * only have an SVG QR should paste its payload into the auto-generate field
 * instead — we then emit an SVG we constructed ourselves.
 */
export const QR_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Max characters accepted in an auto-generate payload (QR version 40 / level M). */
export const QR_PAYLOAD_MAX_LENGTH = 1200;

/**
 * Accepts a same-origin upload path or an absolute https URL, and nothing else.
 *
 * Note the codebase's existing `z.string().url()` on `Pet.image` gets this
 * backwards: it rejects the `/uploads/...` path our uploader actually returns
 * and accepts `javascript:`. Do not copy that pattern.
 */
export function isSafeQrImageUrl(value: string): boolean {
  const url = value.trim();
  if (url === "") return false;

  // Same-origin upload path. Reject protocol-relative `//evil.example` and
  // any traversal out of the uploads directory.
  if (url.startsWith("/")) {
    if (url.startsWith("//")) return false;
    if (url.includes("..")) return false;
    return url.startsWith("/uploads/") && url.length > "/uploads/".length;
  }

  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Trims a QR image URL to `null` when absent, throwing when present but unsafe. */
export function normalizeQrImageUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!isSafeQrImageUrl(trimmed)) {
    throw new Error(
      "QR image must be an uploaded /uploads/... path or an absolute https:// URL."
    );
  }
  return trimmed;
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
  if (data.length > QR_PAYLOAD_MAX_LENGTH) {
    throw new Error(
      `Payload is ${data.length} characters; the maximum is ${QR_PAYLOAD_MAX_LENGTH}.`
    );
  }

  const cellSize = Math.max(1, Math.round(options.cellSize ?? 4));
  const margin = Math.max(4, Math.round(options.margin ?? 4));
  const foreground = safeColor(options.foreground ?? "#18181b", "#18181b");
  const background = safeColor(options.background ?? "#ffffff", "#ffffff");

  // typeNumber 0 lets the library pick the smallest version that fits.
  const qr = qrcode(0, "M");
  qr.addData(data);
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

/** Renders `payload` to an SVG data URI usable as an <img> src. */
export function renderQrDataUri(payload: string, options: RenderQrOptions = {}): string {
  const svg = renderQrSvg(payload, options);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
  const shelterCaption = "Hope for Strays Shelter Selangor";

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
