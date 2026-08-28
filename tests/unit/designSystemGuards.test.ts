import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { cssColorToHex, readCssTokens } from "../support/oklch";
import {
  DESIGN_TONES,
  EMAIL_BRAND,
  EMAIL_RECEIPT,
  EMAIL_TONE,
} from "@/lib/presentation/emailTokens";

/**
 * Structural guards for the design system declared in `src/app/globals.css`.
 *
 * Like `layerBoundaries.test.ts`, these assert properties of the *source text*
 * rather than of runtime behaviour, and for the same reason: a raw
 * `bg-emerald-800`, a class that no longer exists, or a tone slot missing from
 * one theme are all invisible to `tsc`, to ESLint, and to every behavioural
 * test in this suite. The component tree went to 335 raw palette utilities and
 * 54 hardcoded hex colours once already — not in one commit, but one reasonable
 * looking utility at a time. The token layer removed them; this file is what
 * keeps them gone.
 *
 * Background: docs/tasks/TARGET_DESIGN_SYSTEM_GUARDS.md.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");
const GLOBALS = "src/app/globals.css";

/**
 * The tone taxonomy. Seven meanings, seven slots each — a component picks a
 * tone by MEANING and never names a hue. Both lists are the contract that
 * `globals.css`, the presentation layer and every call site agree on, so they
 * are spelled out here rather than derived from the CSS: deriving them would
 * make a deleted tone look like a narrower contract instead of a regression.
 */
const TONES = [
  "success",
  "warning",
  "info",
  "care",
  "danger",
  "highlight",
  "neutral",
] as const;

const SLOTS = [
  "surface",
  "surface-strong",
  "border",
  "text",
  "accent",
  "solid",
  "on-solid",
] as const;

/** Tailwind's built-in palettes — the vocabulary the token layer replaced. */
const PALETTES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

/** Utility prefixes that take a colour. */
const COLOUR_PREFIXES =
  "bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|caret|accent|shadow";

/**
 * HTML email is built with literal hex on purpose: mail clients support neither
 * CSS custom properties nor Tailwind, so a token would arrive as an unstyled
 * colourless table. `emailTokens.ts` is the single hex mirror of globals.css tokens.
 */
const HEX_ALLOWED = new Set(["src/lib/presentation/emailTokens.ts"]);

// ---------------------------------------------------------------------------
// Source loading
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(toRepoPath(full));
  }
  return out;
}

function toRepoPath(abs: string): string {
  return relative(ROOT, abs).replace(/\\/g, "/");
}

/**
 * Blanks block and line comments, preserving line and column offsets so the
 * failure messages below can still report a real `file:line`.
 *
 * Not a nicety. Every shell in this design system is named in a doc comment
 * somewhere — `petStatusPresentation.ts` and `applicationStatusPresentation.ts`
 * both list the tone-aware shells in their JSDoc — and counting a mention as a
 * use is precisely how a `.tone-panel` with zero call sites survived a careful
 * manual audit.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

const files = walk(SRC);
/** Repo path → comment-stripped source. Everything below reads this. */
const sources = new Map<string, string>(
  files.map((file) => [file, stripComments(readFileSync(join(ROOT, file), "utf8"))])
);
const css = readFileSync(join(ROOT, GLOBALS), "utf8");

// ---------------------------------------------------------------------------
// Class-name extraction
// ---------------------------------------------------------------------------

/**
 * Double-quoted and template literals. Single-quoted literals are deliberately
 * excluded: an apostrophe in JSX text (`don't`) is not a string delimiter in
 * the real grammar, and pairing it with the next apostrophe would swallow the
 * `className="..."` that follows and hide a real call site. Nothing in `src/`
 * writes a class list in single quotes.
 */
const LITERAL = /"([^"\\\n]*(?:\\.[^"\\\n]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;

/** Blanks balanced `${…}` spans so an interpolated expression is not tokenised. */
function stripInterpolations(body: string): string {
  let out = "";
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "$" && body[i + 1] === "{") {
      let depth = 1;
      i += 2;
      while (i < body.length && depth > 0) {
        if (body[i] === "{") depth++;
        else if (body[i] === "}") depth--;
        i++;
      }
      i--;
      out += " ";
    } else {
      out += body[i];
    }
  }
  return out;
}

/**
 * True when a literal is a class list rather than prose.
 *
 * Prose is what this excludes: "no receipt was issued." would otherwise mark
 * `.receipt` as used and hide it going dead. Two cheap signals separate them —
 * a class list has no capital letters and no sentence punctuation, while
 * `p-0.5` keeps its dot mid-token.
 */
function isClassList(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (/[A-Z]/.test(trimmed)) return false;
  if (/[.,;!?](\s|$)/.test(trimmed)) return false;
  return true;
}

type ClassUse = { file: string; line: number };

/** class token → where it is written. Built once, read by every class assertion. */
const classUses = new Map<string, ClassUse[]>();

for (const [file, source] of sources) {
  let match: RegExpExecArray | null;
  LITERAL.lastIndex = 0;
  while ((match = LITERAL.exec(source))) {
    const body = stripInterpolations(match[1] ?? match[2] ?? "");
    if (!isClassList(body)) continue;
    const line = lineAt(source, match.index);
    for (const token of body.split(/\s+/)) {
      if (!token) continue;
      const uses = classUses.get(token) ?? [];
      uses.push({ file, line });
      classUses.set(token, uses);
    }
  }
}

// ---------------------------------------------------------------------------
// CSS parsing
// ---------------------------------------------------------------------------

/** The balanced-brace body of the first block whose header matches `header`. */
function block(header: RegExp): string {
  const match = header.exec(css);
  if (!match) throw new Error(`${GLOBALS} has no ${header} block`);
  const open = css.indexOf("{", match.index);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`${GLOBALS}: unbalanced braces after ${header}`);
}

const rootBlock = block(/^:root\s*\{/m);
const darkBlock = block(/^\.dark\s*\{/m);
const themeBlock = block(/^@theme\s+inline\s*\{/m);
const componentsBlock = block(/^@layer\s+components\s*\{/m);

/**
 * Class names declared in `@layer components`.
 *
 * `dark` is excluded: it comes from the `.dark .tone-chip` compound selector and
 * is the theme root class, applied by `ThemeProvider` through `classList` rather
 * than written into markup, so it has no call site to find.
 */
const declaredClasses = new Set<string>();
{
  const selectors = /(^|\})\s*([^{}]+?)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = selectors.exec(componentsBlock))) {
    for (const cls of match[2].matchAll(/\.([a-zA-Z][\w-]*)/g)) {
      if (cls[1] !== "dark") declaredClasses.add(cls[1]);
    }
  }
}

/** Shape of a design-system class, as opposed to a Tailwind utility. */
const SHELL_SHAPE =
  /^(?:tone-[a-z0-9-]+|eyebrow(?:-[a-z0-9-]+)?|receipt(?:-[a-z0-9-]+)?|segmented(?:-[a-z0-9-]+)?)$/;

// ---------------------------------------------------------------------------

describe("design system guards", () => {
  it("finds the sources and declarations it is supposed to be checking", () => {
    // Guards the guard: a broken walk, a mangled comment stripper or a literal
    // scanner that matches nothing would make every assertion below pass
    // vacuously — green, and enforcing nothing.
    expect(files.length, "walk(src) found almost nothing").toBeGreaterThan(100);
    expect(
      declaredClasses.size,
      `@layer components in ${GLOBALS} parsed to almost no classes`
    ).toBeGreaterThanOrEqual(15);
    expect(
      classUses.size,
      "the class-list scanner harvested almost no class names"
    ).toBeGreaterThan(200);
    expect(rootBlock.length).toBeGreaterThan(1000);
    expect(darkBlock.length).toBeGreaterThan(1000);
  });

  // -------------------------------------------------------------------------
  // Colour
  // -------------------------------------------------------------------------

  it("uses no raw Tailwind palette utility", () => {
    const pattern = new RegExp(
      `(?:^|[^a-zA-Z0-9_-])((?:[a-z][a-z0-9-]*:)*(?:${COLOUR_PREFIXES})-(?:${PALETTES})-(?:50|[1-9]00|950))(?![a-zA-Z0-9_-])`,
      "g"
    );

    const offenders: string[] = [];
    for (const [file, source] of sources) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(source))) {
        offenders.push(`${file}:${lineAt(source, match.index)}  ${match[1]}`);
      }
    }

    expect(
      offenders,
      "Raw palette utilities do not follow the theme and drift out of sync with " +
        "their dark-mode twin. Pick a tone by meaning and use its slot instead: " +
        `bg-<tone>-surface, text-<tone>-text, border-<tone>-border, … where <tone> ` +
        `is one of ${TONES.join(", ")}. Declared in ${GLOBALS}.`
    ).toEqual([]);
  });

  it("pairs no dark: variant with a raw palette colour", () => {
    // Subsumed by the assertion above, but kept separate for its message: the
    // instinct being corrected here is "add a dark: override", and the answer
    // is that a token utility already resolves to var(--token) and flips itself.
    const pattern = new RegExp(
      `(?:^|[^a-zA-Z0-9_-])((?:[a-z][a-z0-9-]*:)*dark:(?:[a-z][a-z0-9-]*:)*(?:${COLOUR_PREFIXES})-(?:${PALETTES})-(?:50|[1-9]00|950))(?![a-zA-Z0-9_-])`,
      "g"
    );

    const offenders: string[] = [];
    for (const [file, source] of sources) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(source))) {
        offenders.push(`${file}:${lineAt(source, match.index)}  ${match[1]}`);
      }
    }

    expect(
      offenders,
      "A token utility already flips with the theme — it resolves to " +
        "var(--token), which .dark redefines. Writing a dark: pair here recreates " +
        "the ~180 hand-maintained overrides the token layer removed. Drop the " +
        "variant and use the tone slot."
    ).toEqual([]);
  });

  it("hardcodes no hex colour outside the HTML email builders", () => {
    const pattern = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;

    const offenders: string[] = [];
    for (const [file, source] of sources) {
      if (HEX_ALLOWED.has(file)) continue;
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(source))) {
        offenders.push(`${file}:${lineAt(source, match.index)}  ${match[0]}`);
      }
    }

    expect(
      offenders,
      `A literal hex is a colour that no theme can reach. Declare it as a token in ` +
        `${GLOBALS} and consume the generated utility. The only exceptions are ` +
        `${[...HEX_ALLOWED].join(" and ")}, which build HTML email — mail clients ` +
        "support neither custom properties nor Tailwind."
    ).toEqual([]);
  });

  /**
   * The HTML-email hex mirror.
   *
   * `src/lib/email.ts` and `src/actions/settings.ts` cannot use a token: mail clients support
   * neither custom properties nor `oklch()`. So parity cannot mean "reference the token" — it
   * can only mean "a hex mirror of the token, provably equal to it". These are that proof.
   *
   * The converter is imported, not written here. An inline copy would be a second
   * implementation of the same arithmetic, and — worse — the mirror's values were generated
   * with it, so a converter that is wrong would be wrong in both places at once and agree
   * with itself. `tests/unit/oklch.test.ts` pins the imported one against the sRGB primaries,
   * which are external ground truth.
   */
  describe("the HTML-email hex mirror", () => {
    const rootTokens = readCssTokens(rootBlock);

    /**
     * camelCase → the kebab-case tail of a token name.
     *
     * There is deliberately no `{ constant → token }` lookup table: a table would be the
     * palette written a third time, which is the defect this whole mirror exists to remove.
     * The key *is* the token name, and this is the rule that says so.
     */
    const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

    /** Every mirrored value, paired with the `:root` token it claims to mirror. */
    const MIRRORED: Array<{ path: string; token: string; hex: string }> = [
      ...Object.entries(EMAIL_BRAND).map(([key, hex]) => ({
        path: `EMAIL_BRAND.${key}`,
        token: `--${kebab(key)}`,
        hex,
      })),
      ...Object.entries(EMAIL_TONE).flatMap(([tone, slots]) =>
        Object.entries(slots).map(([slot, hex]) => ({
          path: `EMAIL_TONE.${tone}.${slot}`,
          token: `--tone-${tone}-${kebab(slot)}`,
          hex,
        }))
      ),
      ...Object.entries(EMAIL_RECEIPT).map(([key, hex]) => ({
        path: `EMAIL_RECEIPT.${key}`,
        token: `--receipt-${kebab(key)}`,
        hex,
      })),
    ];

    it("finds the mirror and the tokens it is supposed to be comparing", () => {
      // Guards the guard. An empty mirror, or a `:root` that stopped parsing, would make the
      // assertion below iterate over nothing and pass while proving nothing at all.
      expect(MIRRORED.length, "the mirror harvested almost nothing").toBeGreaterThanOrEqual(30);
      expect(rootTokens.size, `${GLOBALS} :root parsed to almost no tokens`).toBeGreaterThan(60);
    });

    it("equals the computed value of every globals.css token it mirrors", () => {
      // The assertion that makes the whole thing hold. Everything else in this describe block
      // is about completeness; this is the one that says the colours are actually the same.
      const offenders: string[] = [];

      for (const { path, token, hex } of MIRRORED) {
        const declaration = rootTokens.get(token);
        if (declaration === undefined) {
          // Never skipped. A token the mirror names but `:root` does not declare is a typo in
          // the key, and silently passing over it is how a guard comes to enforce nothing.
          offenders.push(`${path} mirrors ${token}, which :root does not declare`);
          continue;
        }
        const expected = cssColorToHex(declaration);
        if (hex.toLowerCase() !== expected) {
          offenders.push(`${path} is ${hex}, but ${token} (${declaration}) computes to ${expected}`);
        }
      }

      expect(
        offenders,
        "The email palette has drifted from the token layer. These two files are the only " +
          "colour surface no theme can reach, so nothing else will report it: the shelter's " +
          "app would go on being warm cream and terracotta while its email quietly went back " +
          `to slate and sky. Recompute the value from ${GLOBALS} rather than editing it by eye.`
      ).toEqual([]);
    });

    it("covers every tone the design system declares", () => {
      // An eighth tone added to globals.css must not reach the inbox as the default sky
      // badge. The mirror enumerating all seven is what makes that a build failure.
      expect(
        [...DESIGN_TONES],
        "DESIGN_TONES in emailTokens.ts has fallen behind the tone taxonomy"
      ).toEqual([...TONES]);

      expect(
        Object.keys(EMAIL_TONE).sort(),
        "EMAIL_TONE is missing a tone, so a status mapped to it has no email colour"
      ).toEqual([...TONES].sort());
    });

    it("mirrors the whole --receipt-* group", () => {
      // The Sec 44(6) receipt is the most consequential thing this codebase sends, and the
      // emailed and printed halves are supposed to be the same document. A --receipt-* token
      // added for the printed one and not mirrored here is how they drift apart again.
      const declared = [...rootTokens.keys()].filter((t) => t.startsWith("--receipt-")).sort();
      const mirrored = Object.keys(EMAIL_RECEIPT)
        .map((key) => `--receipt-${kebab(key)}`)
        .sort();

      expect(
        mirrored,
        "The emailed receipt mirrors the --receipt-* group as a whole, so that it and the " +
          "printed receipt for the same donation stay the same document."
      ).toEqual(declared);
    });
  });

  // -------------------------------------------------------------------------
  // Type and shape scales
  // -------------------------------------------------------------------------

  it("uses no arbitrary type, radius or elevation value", () => {
    // 121 arbitrary font sizes (text-[9px], text-[10px], text-[11px]) and a
    // hand-written shadow per card is the state this scale replaced.
    //
    // Deliberately limited to the three *design-scale* prefixes. Every other
    // arbitrary value in src/ is a layout dimension — leading-[1.15],
    // min-h-[360px], max-w-[200px], w-[95vw], grid-cols-[1fr_auto],
    // stroke-[2.5] and ring-[3px] (both the *width* senses) — and a grid cell
    // that has to be 360px tall is not a design token. Widening this list to
    // "any arbitrary value" turns ~20 legitimate call sites red and teaches
    // people to skip the guard, which is the failure mode this whole file is
    // written to avoid.
    //
    // The colour senses of those same prefixes are not a hole: ring-[#fff]
    // would be caught by the hex assertion above. The two rules interlock, so
    // do not "fix" this one by adding colour prefixes to it.
    const pattern = /(?:^|[^a-zA-Z0-9_-])((?:[a-z][a-z0-9-]*:)*(?:text|rounded|shadow)-\[[^\]]*\])/g;

    const offenders: string[] = [];
    for (const [file, source] of sources) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(source))) {
        offenders.push(`${file}:${lineAt(source, match.index)}  ${match[1]}`);
      }
    }

    expect(
      offenders,
      "Every one of these has a named step. Type runs text-3xs, text-2xs, " +
        "text-xs … ; radii run rounded-sm … rounded-4xl plus the named shapes " +
        "rounded-mark, rounded-control, rounded-card, rounded-dialog; elevation " +
        `runs shadow-brand-xs … shadow-brand-xl. All declared in ${GLOBALS}. If a ` +
        "value is genuinely missing from the scale, add the step there rather " +
        "than inlining it at one call site."
    ).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Tone vocabulary
  // -------------------------------------------------------------------------

  it("names only the seven tones and their seven slots", () => {
    const slotPattern = new RegExp(
      `(?:^|[^a-zA-Z0-9_-])(?:[a-z][a-z0-9-]*:)*(?:${COLOUR_PREFIXES})-(${TONES.join("|")})-([a-z][a-z0-9-]*)`,
      "g"
    );
    const tonePattern = new RegExp(
      `(?:^|[^a-zA-Z0-9_-])(?:[a-z][a-z0-9-]*:)*(?:${COLOUR_PREFIXES})-([a-z][a-z0-9]*)-(?:surface-strong|surface|on-solid|solid|accent)(?![a-zA-Z0-9_-])`,
      "g"
    );

    const offenders: string[] = [];
    for (const [file, source] of sources) {
      let match: RegExpExecArray | null;

      slotPattern.lastIndex = 0;
      while ((match = slotPattern.exec(source))) {
        if (!(SLOTS as readonly string[]).includes(match[2])) {
          offenders.push(
            `${file}:${lineAt(source, match.index)}  ${match[1]}-${match[2]} is not a slot`
          );
        }
      }

      tonePattern.lastIndex = 0;
      while ((match = tonePattern.exec(source))) {
        if (!(TONES as readonly string[]).includes(match[1])) {
          offenders.push(
            `${file}:${lineAt(source, match.index)}  ${match[1]} is not a tone`
          );
        }
      }
    }

    expect(
      offenders,
      `Tones are ${TONES.join(", ")}; slots are ${SLOTS.join(", ")}. A utility ` +
        "naming anything else resolves to no colour at all — Tailwind emits " +
        "nothing and the element silently renders unstyled, which is how " +
        "bg-success-surface-strong once became the nonexistent tone-success-strong."
    ).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // The component layer
  // -------------------------------------------------------------------------

  it("gives every class declared in @layer components a call site", () => {
    // The .tone-panel guard. That class shipped with zero call sites while 17
    // elements hand-rolled the triplet it existed to replace, and the manual
    // audit counted its three doc-comment mentions as usage. Comments are
    // stripped before this runs, so a mention is no longer a use.
    const orphans = [...declaredClasses]
      .filter((cls) => !classUses.has(cls))
      .sort();

    expect(
      orphans,
      `Declared in @layer components in ${GLOBALS} and used by nothing. Either ` +
        "adopt it at the call sites that hand-roll what it does, or delete it — " +
        "dead CSS ships to every visitor and reads as available when it is not. " +
        "Note that `border-receipt-rule` is the token utility, not the shell " +
        "`.receipt-rule`; the two are easy to confuse."
    ).toEqual([]);
  });

  it("declares every design-system class that a component uses", () => {
    // The tone-success-strong guard. An unknown class fails silently: Tailwind
    // emits nothing, no error is raised, and the element renders unstyled.
    const undeclared = [...classUses.entries()]
      .filter(([cls]) => SHELL_SHAPE.test(cls) && !declaredClasses.has(cls))
      .map(([cls, uses]) => `${uses[0].file}:${uses[0].line}  ${cls}`)
      .sort();

    expect(
      undeclared,
      `Used in a class list but not declared in @layer components in ${GLOBALS}. ` +
        "An unknown class is not an error anywhere in the toolchain — it simply " +
        "produces no CSS — so the element keeps whatever it had and the bug is " +
        "only visible to the eye. Check the spelling against the declarations."
    ).toEqual([]);
  });

  it("applies no variant to a design-system class", () => {
    // `dark:tone-ink` compiles to nothing: variants generate utilities, and a
    // component class is not one. The element silently keeps its light colour.
    const offenders = [...classUses.entries()]
      .filter(([cls]) => cls.includes(":") && declaredClasses.has(cls.slice(cls.lastIndexOf(":") + 1)))
      .map(([cls, uses]) => `${uses[0].file}:${uses[0].line}  ${cls}`)
      .sort();

    expect(
      offenders,
      "A variant on a component class compiles to nothing — Tailwind generates " +
        "variants for utilities, not for classes declared in @layer components. " +
        "The element keeps its base styling and nothing reports it. For a " +
        "theme-dependent value the token already flips; for a state, put the " +
        "variant on a utility or add the rule to the shell itself."
    ).toEqual([]);
  });

  it("maps all seven slots in every tone selector, each to its own tone", () => {
    // A rename or a copy-paste is what this catches: `.tone-care` inheriting
    // `--tone-text: var(--tone-danger-text)` is legal CSS, renders a plausible
    // colour, and mislabels every animal under veterinary care as an emergency.
    const problems: string[] = [];

    for (const tone of TONES) {
      const selector = new RegExp(`^\\s*\\.tone-${tone}\\s*\\{`, "m");
      if (!selector.test(componentsBlock)) {
        problems.push(`.tone-${tone} is not declared`);
        continue;
      }
      const body = componentsBlock.slice(
        componentsBlock.indexOf("{", selector.exec(componentsBlock)!.index) + 1
      );
      const rule = body.slice(0, body.indexOf("}"));

      for (const slot of SLOTS) {
        const expected = new RegExp(
          `--tone-${slot}:\\s*var\\(--tone-${tone}-${slot}\\)\\s*;`
        );
        if (!expected.test(rule)) {
          problems.push(`.tone-${tone} does not map --tone-${slot} to --tone-${tone}-${slot}`);
        }
      }
    }

    expect(
      problems,
      "Each tone selector remaps the local --tone-* group and nothing else, so " +
        "every shell that reads the group works with every tone. A missing slot " +
        "leaves the previous tone's value in place; a slot pointing at another " +
        "tone's token renders the wrong meaning in a colour that looks deliberate."
    ).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Tokens
  // -------------------------------------------------------------------------

  it("declares every tone slot in both themes", () => {
    // A slot present in :root and missing from .dark is invisible until someone
    // switches theme, at which point the utility resolves to an undefined var
    // and the element loses its colour entirely.
    const missing: string[] = [];

    for (const tone of TONES) {
      for (const slot of SLOTS) {
        const declaration = new RegExp(`--tone-${tone}-${slot}:\\s*[^;]+;`);
        if (!declaration.test(rootBlock)) missing.push(`:root is missing --tone-${tone}-${slot}`);
        if (!declaration.test(darkBlock)) missing.push(`.dark is missing --tone-${tone}-${slot}`);
      }
    }

    expect(
      missing,
      `All ${TONES.length} tones declare all ${SLOTS.length} slots in both :root ` +
        `and .dark in ${GLOBALS}. An undefined custom property does not fall back ` +
        "to the light value — it resolves to nothing and the colour disappears."
    ).toEqual([]);
  });

  it("exposes every tone slot to Tailwind through @theme inline", () => {
    const missing: string[] = [];

    for (const tone of TONES) {
      for (const slot of SLOTS) {
        const mapping = new RegExp(
          `--color-${tone}-${slot}:\\s*var\\(--tone-${tone}-${slot}\\)\\s*;`
        );
        if (!mapping.test(themeBlock)) {
          missing.push(`--color-${tone}-${slot}: var(--tone-${tone}-${slot});`);
        }
      }
    }

    expect(
      missing,
      "A tone slot with no @theme inline mapping generates no utility, so " +
        "`bg-<tone>-<slot>` produces no CSS at the call site and the element " +
        "renders unstyled. The indirection through var() is what makes the " +
        "generated utility theme-aware — map it, do not inline the value."
    ).toEqual([]);
  });

  it("never overrides a receipt token in dark mode", () => {
    const overridden = [...darkBlock.matchAll(/(--receipt-[a-z-]+)\s*:/g)].map((m) => m[1]);

    expect(
      overridden,
      "A Sec 44(6) tax receipt is black ink on white paper in every theme and " +
        "has to stay legible through a monochrome printer. Overriding a " +
        "--receipt-* token in .dark prints a donor an unreadable statutory " +
        "document. These tokens are deliberately absent from .dark."
    ).toEqual([]);
  });
});
