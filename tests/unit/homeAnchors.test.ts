import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, resolve, relative, sep } from "path";
import { fileURLToPath } from "url";

/**
 * Structural guard: every `/#id` link in `src` targets an id the home page
 * actually renders.
 *
 * Like `designSystemGuards.test.ts` and `layerBoundaries.test.ts`, this asserts
 * a property of the *source text* rather than of runtime behaviour, because the
 * defect it exists to prevent is invisible to `tsc`, to ESLint and to every
 * behavioural test here. `1137d3e` took `HomeProcessSection`,
 * `HomeCommunitySection` and `HomeGalleryHeader` out of `src/app/page.tsx` and
 * left four links pointing into their anchors. Each one landed at the top of
 * `/` with nothing to scroll to, for sixteen days, and nothing went red.
 *
 * **Why this walks down from `page.tsx` rather than grepping for the id.** A
 * grep for `id="support"` finds it in `HomeSections.tsx` whether or not
 * anything mounts the component declaring it — which is exactly the mistake
 * recorded in
 * `tasks/lessons/2026-09-18-a-grep-for-an-anchor-id-proves-it-is-declared-not-rendered.md`.
 * So ids are attributed to the *component* that declares them, and only
 * components reachable from the home page's render tree contribute.
 *
 * ceiling: the walk does not evaluate conditionals, so an id inside a
 * `{showFilters && ...}` block, or on a dialog that opens on click, counts as
 * rendered. That over-approximates — it can accept a link this page would not
 * in fact scroll to, but it cannot reject a valid one, and it still catches a
 * component that is mounted nowhere, which is the defect here. Rendering the
 * tree in jsdom would settle the conditionals, but only for the component list
 * a test hardcodes, which reintroduces the very declared-versus-rendered gap
 * above. Narrow it by evaluating the guards, not by listing components.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");
const ENTRY = join(SRC, "app", "page.tsx");

/** Every `.ts`/`.tsx` file under `src`. */
function sourceFiles(dir: string = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Resolve an `@/`-aliased or relative import to a file on disk. */
function resolveImport(specifier: string, fromFile: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : null;
  if (!base) return null; // a package, not our source
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** name -> file, for every named import in `text` that resolves into `src`. */
function importMap(text: string, fromFile: string): Map<string, string> {
  const map = new Map<string, string>();
  const named = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  for (const [, names, specifier] of text.matchAll(named)) {
    const file = resolveImport(specifier, fromFile);
    if (!file) continue;
    for (const raw of names.split(",")) {
      const name = raw.split(/\s+as\s+/).pop()!.trim();
      if (name) map.set(name, file);
    }
  }
  return map;
}

/**
 * Split a file into top-level component blocks, so an id can be attributed to
 * the component that declares it rather than to the file that holds it.
 */
function componentBlocks(text: string): Map<string, string> {
  const lines = text.split(/\r?\n/);
  const starts: { name: string; line: number }[] = [];
  lines.forEach((line, i) => {
    const fn = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w*)/.exec(line);
    const arrow = /^(?:export\s+)?const\s+([A-Z]\w*)\s*[:=]/.exec(line);
    const name = fn?.[1] ?? arrow?.[1];
    if (name) starts.push({ name, line: i });
  });
  const blocks = new Map<string, string>();
  starts.forEach(({ name, line }, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    blocks.set(name, lines.slice(line, end).join("\n"));
  });
  return blocks;
}

const ID_ATTRIBUTE = /\bid=["']([A-Za-z0-9_-]+)["']/g;
const RENDERED_COMPONENT = /<([A-Z]\w*)/g;

/**
 * Raw elements an `/#id` can sensibly scroll to.
 *
 * An allowlist rather than a denylist, because most ids in this tree belong to
 * form controls — and they are written on wrappers like `<Input id=…>`, so
 * excluding `input` by name would miss them and the guard would accept
 * `/#donorEmail`. Every anchor the site actually uses sits on a `<section>`.
 * An anchor added to a `<span>` would be rejected; move it to a landmark.
 */
const ANCHORABLE_ELEMENTS = new Set([
  "section",
  "div",
  "main",
  "article",
  "aside",
  "nav",
  "header",
  "footer",
  "h1",
  "h2",
  "h3",
]);

/** The JSX tag an `id=` sits on — the nearest `<tag` before it. */
function owningTag(body: string, idIndex: number): string {
  const open = body.lastIndexOf("<", idIndex);
  if (open === -1) return "";
  return /^<\s*([A-Za-z][\w.-]*)/.exec(body.slice(open, idIndex))?.[1] ?? "";
}

/** Ids rendered by the home page, walking down from its render tree. */
function homePageIds(): Set<string> {
  const ids = new Set<string>();
  const seen = new Set<string>();

  function visit(file: string, source: string) {
    const text = readFileSync(file, "utf8");
    const imports = importMap(text, file);
    const blocks = componentBlocks(text);
    // The entry is one component, so its whole text is its body. Elsewhere,
    // only the named component's block counts.
    const body = file === ENTRY ? text : (blocks.get(source) ?? "");
    if (!body) return;

    for (const match of body.matchAll(ID_ATTRIBUTE)) {
      if (ANCHORABLE_ELEMENTS.has(owningTag(body, match.index!))) ids.add(match[1]);
    }

    for (const [, name] of body.matchAll(RENDERED_COMPONENT)) {
      // A component declared in this same file, or imported from src.
      const target = blocks.has(name) ? file : imports.get(name);
      if (!target) continue;
      const key = `${target}::${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      visit(target, name);
    }
  }

  visit(ENTRY, "HomePage");
  return ids;
}

/** Every `/#id` reference anywhere under `src`, with where it was written. */
function homeAnchorLinks(): { file: string; line: number; id: string }[] {
  const found: { file: string; line: number; id: string }[] = [];
  for (const file of sourceFiles()) {
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((text, i) => {
        for (const [, id] of text.matchAll(/["'`]\/#([A-Za-z0-9_-]+)/g)) {
          found.push({ file: relative(ROOT, file).split(sep).join("/"), line: i + 1, id });
        }
      });
  }
  return found;
}

describe("home page anchors", () => {
  it("walks the home page's render tree rather than the whole source", () => {
    // Anchors the walker itself. Without this, a bug that returned every id in
    // the repo — or none — would make the real assertion below vacuous.
    const ids = homePageIds();

    expect(ids).toContain("our-work");
    expect(ids).toContain("adopt");
    expect(ids).toContain("mission");
    expect(ids).toContain("how-it-works");

    // `#support` is declared nowhere now, and `#volunteer` is declared on
    // `/get-involved` — a page the home tree does not reach. Both must be
    // absent, or the walk is reading files instead of following renders.
    expect(ids).not.toContain("support");
    expect(ids).not.toContain("volunteer");
  });

  it("points every /#id link in src at an id the home page renders", () => {
    const rendered = homePageIds();
    const broken = homeAnchorLinks().filter((link) => !rendered.has(link.id));

    expect(
      broken.map((b) => `${b.file}:${b.line} -> /#${b.id}`),
      `the home page renders [${[...rendered].sort().join(", ")}]`
    ).toEqual([]);
  });
});
