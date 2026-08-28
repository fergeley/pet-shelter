/**
 * A dependency-free `oklch()` → sRGB hex converter, for the design-system guards.
 *
 * Why this exists: `src/app/globals.css` declares the palette in `oklch()`, and HTML email
 * can render neither `oklch()` nor `var()`. Parity between the two therefore cannot mean
 * "reference the token" — it can only mean "a hex mirror of the token, provably equal to
 * it". This is the thing that computes the proof.
 *
 * It lives in the test tier on purpose. Nothing in `src/` needs it at runtime: the mirror in
 * `src/lib/presentation/emailTokens.ts` is a set of literal hex constants, and this converter
 * is what fails the build when one of them stops matching the token it claims to mirror.
 *
 * The pipeline is CSS Color 4 §  OKLab: OKLCH → OKLab → LMS → linear sRGB → gamma-encoded
 * sRGB. `tests/unit/oklch.test.ts` pins it against the sRGB primaries, whose OKLCH
 * coordinates are published constants — external ground truth matters here more than usual,
 * because a converter that is wrong in the same direction as the values it generated would
 * agree with itself and enforce nothing.
 */

/** OKLab → LMS′ (CSS Color 4). */
const LAB_TO_LMS = [
  [1, +0.3963377774, +0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.2914855480],
] as const;

/** LMS → linear sRGB (CSS Color 4). */
const LMS_TO_RGB = [
  [+4.0767416621, -3.3077115913, +0.2309699292],
  [-1.2684380046, +2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, +1.7076147010],
] as const;

/** The sRGB transfer function: linear light → the encoded value a display is sent. */
function encodeSrgb(channel: number): number {
  return channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

function toHexPair(channel: number): string {
  const clamped = Math.min(1, Math.max(0, channel));
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
}

/**
 * Converts OKLCH to a `#rrggbb` string.
 *
 * @param lightness 0–1 (not a percentage — the parser below does that conversion)
 * @param chroma    0–~0.4
 * @param hue       degrees
 *
 * Out-of-gamut colours are clamped per channel, which is what a browser does when it has to
 * put an `oklch()` on an sRGB display. Every token in this codebase is in gamut, so the
 * clamp never fires in practice; it is here so a future out-of-gamut token produces a
 * defined value rather than `NaN`.
 */
export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const lms = LAB_TO_LMS.map(([kl, ka, kb]) => kl * lightness + ka * a + kb * b);
  // The nonlinearity: LMS′ is a cube root of cone response, so cubing undoes it.
  const cubed = lms.map((component) => component ** 3);

  const linear = LMS_TO_RGB.map(([kr, kg, kb]) => kr * cubed[0] + kg * cubed[1] + kb * cubed[2]);

  return `#${linear.map(encodeSrgb).map(toHexPair).join("")}`;
}

/** Expands `#abc` to `#aabbcc` and lowercases, so every value in the mirror compares equal. */
function normalizeHex(value: string): string {
  const digits = value.slice(1);
  const expanded =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits;
  return `#${expanded.toLowerCase()}`;
}

/**
 * Resolves one CSS colour declaration — as written in `globals.css` — to `#rrggbb`.
 *
 * Handles the two forms the token layer actually uses: an `oklch()` triple and a literal
 * hex (`--receipt-paper`, `--background` and the `on-solid` slots are declared as hex
 * already). Anything else throws rather than returning a plausible wrong colour, because
 * the caller is a guard: a silently skipped token is a guard that passes while checking
 * nothing.
 */
export function cssColorToHex(declaration: string): string {
  const { hex, alpha } = parseCssColor(declaration);

  // Alpha is deliberately unsupported *here* rather than flattened. A translucent token
  // composites against whatever is behind it, and an email has no way to know what that is —
  // mirroring one as opaque hex would silently ship a colour nobody chose. No token the email
  // mirror covers has alpha; `--frame` and the dark tone surfaces do, which is why this is a
  // throw and not an assumption. Callers that *can* name the backdrop use `compositeOver`.
  if (alpha !== 1) {
    throw new Error(
      `cssColorToHex refuses the translucent colour "${declaration}": a hex mirror cannot ` +
        "carry alpha, and compositing it against an unknown backdrop would invent a colour."
    );
  }

  return hex;
}

/**
 * Resolves a CSS colour declaration to an opaque hex plus its alpha, without judging the alpha.
 *
 * Split out from `cssColorToHex` so there is exactly one parser: the email mirror needs a
 * colour that refuses to be translucent, and the contrast guard needs one that composites
 * instead. Two parsers would be two places to get `none` or a percentage wrong.
 */
export function parseCssColor(declaration: string): { hex: string; alpha: number } {
  const value = declaration.trim();

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return { hex: normalizeHex(value), alpha: 1 };
  }

  const oklch = /^oklch\(\s*([^\s/]+)\s+([^\s/]+)\s+([^\s/)]+)\s*(?:\/\s*([^\s)]+)\s*)?\)$/i.exec(
    value
  );
  if (!oklch) {
    throw new Error(
      `cssColorToHex cannot read "${declaration}". Expected an oklch() triple or a literal hex.`
    );
  }

  const [, rawL, rawC, rawH, rawAlpha] = oklch;

  // `none` is CSS Color 4's missing-component keyword and behaves as 0. It appears on the
  // achromatic tokens (`oklch(98.5% 0 none)`), where hue is genuinely undefined.
  const parseComponent = (raw: string, scale: number): number => {
    if (raw.toLowerCase() === "none") return 0;
    const numeric = raw.endsWith("%") ? Number(raw.slice(0, -1)) / scale : Number(raw);
    if (!Number.isFinite(numeric)) {
      throw new Error(`cssColorToHex cannot read the component "${raw}" in "${declaration}".`);
    }
    return numeric;
  };

  return {
    hex: oklchToHex(parseComponent(rawL, 100), parseComponent(rawC, 1), parseComponent(rawH, 1)),
    alpha: rawAlpha === undefined ? 1 : parseComponent(rawAlpha, 100),
  };
}

/**
 * Flattens a translucent colour onto an opaque backdrop, the way a browser paints it.
 *
 * Needed because half the dark palette is translucent — `.dark`'s tone surfaces are declared
 * `oklch(… / 0.45)` over the page background. A contrast check that skipped them would exempt
 * seven surfaces while reporting green, which is worse than not checking at all.
 */
export function compositeOver(colour: { hex: string; alpha: number }, backdrop: string): string {
  if (colour.alpha >= 1) return colour.hex;
  const front = channels(colour.hex);
  const back = channels(backdrop);
  return `#${front
    .map((c, i) => Math.round(c * colour.alpha + back[i] * (1 - colour.alpha)))
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** The 0–255 channels of a `#rrggbb`. */
function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * WCAG 2.x relative luminance.
 *
 * The same linear-sRGB step the OKLCH pipeline already runs, weighted by the sRGB primaries —
 * which is why the contrast work was cheap once the converter existed.
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex)
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1:1 to 21:1. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Every `--custom-property: value;` declared directly in a CSS block body.
 *
 * Takes the balanced-brace body of a block (`:root`, `.dark`) rather than the whole
 * stylesheet, so a value cannot be picked up from the wrong theme.
 */
export function readCssTokens(blockBody: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [, name, value] of blockBody.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}
