import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import {
  compositeOver,
  contrastRatio,
  cssColorToHex,
  oklchToHex,
  parseCssColor,
  readCssTokens,
  relativeLuminance,
} from "../support/oklch";

/**
 * Pins the `oklch()` → hex converter against values it did not produce.
 *
 * This file is load-bearing for `designSystemGuards.test.ts`. That suite proves the email
 * hex mirror equals the computed value of each `globals.css` token — but the mirror's
 * values were themselves generated with this converter, so a converter that is wrong would
 * be wrong in both places at once, agree with itself, and enforce nothing. The anchors below
 * are external ground truth: the OKLCH coordinates of the sRGB primaries are published
 * constants, and three independent primaries plus white, black and a mid grey pin every
 * entry of both matrices, the cube-root nonlinearity and the transfer function.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

describe("oklch → sRGB hex", () => {
  /** The sRGB primaries and greys, in OKLCH (CSS Color 4). */
  const ANCHORS: Array<[name: string, oklch: [number, number, number], hex: string]> = [
    ["red", [0.62796, 0.25768, 29.234], "#ff0000"],
    ["green", [0.86644, 0.29483, 142.4953], "#00ff00"],
    ["blue", [0.45201, 0.31321, 264.052], "#0000ff"],
    ["white", [1, 0, 0], "#ffffff"],
    ["black", [0, 0, 0], "#000000"],
    ["mid grey", [0.59987, 0, 89.876], "#808080"],
  ];

  it.each(ANCHORS)("converts %s exactly", (_name, [l, c, h], hex) => {
    expect(oklchToHex(l, c, h)).toBe(hex);
  });

  it("clamps an out-of-gamut colour per channel instead of returning NaN", () => {
    // No token is out of gamut today. This is about what happens when one is: a defined,
    // clamped colour is recoverable, `#NaNNaNNaN` in a donor's inbox is not.
    expect(oklchToHex(0.7, 0.4, 150)).toMatch(/^#[0-9a-f]{6}$/);
  });

  describe("reading a declaration as written in globals.css", () => {
    it("passes a literal hex through, normalised", () => {
      expect(cssColorToHex("#FFFFFF")).toBe("#ffffff");
      expect(cssColorToHex("#fff")).toBe("#ffffff");
      expect(cssColorToHex("  #FFF8F4  ")).toBe("#fff8f4");
    });

    it("reads a percentage lightness and a `none` hue", () => {
      // `oklch(98.5% 0 none)` is how the achromatic tokens are written: hue is genuinely
      // undefined at zero chroma, and CSS Color 4's `none` keyword behaves as 0.
      expect(cssColorToHex("oklch(98.5% 0 none)")).toBe(cssColorToHex("oklch(98.5% 0 0)"));
      expect(cssColorToHex("oklch(100% 0 none)")).toBe("#ffffff");
    });

    it("refuses a translucent colour rather than inventing an opaque one", () => {
      // `--frame` is declared this way. Flattening it would require knowing what is behind
      // it, which an email does not.
      expect(() => cssColorToHex("oklch(92% 0.004 286.32 / 0.8)")).toThrow(/alpha/i);
      expect(cssColorToHex("oklch(92% 0.004 286.32 / 1)")).toBe(cssColorToHex("oklch(92% 0.004 286.32)"));
    });

    it("throws on anything it cannot read, rather than returning a plausible colour", () => {
      // The property that stops a guard from passing vacuously over a token it misparsed.
      expect(() => cssColorToHex("var(--primary)")).toThrow();
      expect(() => cssColorToHex("rgb(255 0 0)")).toThrow();
      expect(() => cssColorToHex("oklch(43.2% 0.095)")).toThrow();
      expect(() => cssColorToHex("oklch(nonsense 0.095 166)")).toThrow();
    });
  });

  describe("cross-check against a palette generated elsewhere", () => {
    /**
     * The neutral ramp in `globals.css` is Tailwind's `zinc`, whose hex values predate this
     * converter and were not produced by it. Agreement to within one 8-bit step across the
     * whole ramp is independent evidence that the pipeline is right — and unlike the
     * primaries above, these are the *kind* of value the mirror actually carries.
     */
    const ZINC: Array<[oklch: string, hex: string]> = [
      ["oklch(98.5% 0 none)", "#fafafa"],
      ["oklch(96.7% 0.001 286.375)", "#f4f4f5"],
      ["oklch(92% 0.004 286.32)", "#e4e4e7"],
      ["oklch(87.1% 0.006 286.286)", "#d4d4d8"],
      ["oklch(55.2% 0.016 285.938)", "#71717a"],
      ["oklch(44.2% 0.017 285.786)", "#52525b"],
      ["oklch(37% 0.013 285.805)", "#3f3f46"],
      ["oklch(27.4% 0.006 286.033)", "#27272a"],
      ["oklch(21% 0.006 285.885)", "#18181b"],
    ];

    it.each(ZINC)("%s is within one step of %s", (oklch, hex) => {
      const got = cssColorToHex(oklch);
      const channels = (value: string) =>
        [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
      const distance = Math.max(
        ...channels(got).map((c, i) => Math.abs(c - channels(hex)[i]))
      );
      expect(distance, `${oklch} → ${got}, expected ≈ ${hex}`).toBeLessThanOrEqual(1);
    });
  });

  describe("reading tokens out of a CSS block", () => {
    it("harvests the declarations of the block it is given, and no others", () => {
      const tokens = readCssTokens(`
        --background: #fff8f4;
        --tone-success-text: oklch(43.2% 0.095 166.913);
      `);
      expect(tokens.get("--background")).toBe("#fff8f4");
      expect(tokens.get("--tone-success-text")).toBe("oklch(43.2% 0.095 166.913)");
      expect(tokens.size).toBe(2);
    });

    it("reads the real :root block", () => {
      // Guards the guard: a rename or a reformat of globals.css that broke this extraction
      // would leave designSystemGuards checking an empty map.
      const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
      const open = css.indexOf("{", css.search(/^:root\s*\{/m));
      let depth = 0;
      let body = "";
      for (let i = open; i < css.length; i++) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}" && --depth === 0) {
          body = css.slice(open + 1, i);
          break;
        }
      }

      const tokens = readCssTokens(body);
      expect(tokens.size).toBeGreaterThan(60);
      expect(tokens.get("--background")).toBe("#fff8f4");
      expect(tokens.get("--receipt-paper")).toBe("#ffffff");
    });
  });

  describe("contrast, for the guard that reads these values", () => {
    // Anchored on ratios that are fixed by the WCAG formula rather than by this
    // implementation: black on white is 21:1 exactly, and #777 on white is the canonical
    // "just above 4.5" value quoted in the spec's own examples.
    it("computes the WCAG ratios", () => {
      expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
      expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
      expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.478, 2);
      expect(contrastRatio("#808080", "#ffffff")).toBeCloseTo(3.949, 2);
    });

    it("does not care which colour is named first", () => {
      expect(contrastRatio("#b2594f", "#fff8f4")).toBeCloseTo(
        contrastRatio("#fff8f4", "#b2594f"),
        10
      );
    });

    it("puts relative luminance at the ends of its range", () => {
      expect(relativeLuminance("#000000")).toBeCloseTo(0, 6);
      expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
    });

    it("reads alpha off a translucent declaration instead of refusing it", () => {
      // `cssColorToHex` throws on these; the contrast guard needs them, because half the dark
      // palette is declared this way.
      const translucent = parseCssColor("oklch(26.2% 0.051 172.552 / 0.45)");
      expect(translucent.alpha).toBeCloseTo(0.45, 5);
      expect(translucent.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(parseCssColor("oklch(92% 0.004 286.32)").alpha).toBe(1);
    });

    it("composites a translucent colour onto its backdrop", () => {
      // Half-opacity black over white is mid grey; a fully opaque colour ignores the backdrop.
      expect(compositeOver({ hex: "#000000", alpha: 0.5 }, "#ffffff")).toBe("#808080");
      expect(compositeOver({ hex: "#ff0000", alpha: 1 }, "#00ff00")).toBe("#ff0000");
      expect(compositeOver({ hex: "#ffffff", alpha: 0 }, "#123456")).toBe("#123456");
    });
  });
});
