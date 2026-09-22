import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname, resolve, relative, sep } from "path";
import { fileURLToPath } from "url";

/**
 * Structural guard: every in-app `#anchor` link in `src` targets an id that the
 * page it points at actually renders.
 *
 * Like `designSystemGuards.test.ts` and `layerBoundaries.test.ts`, this asserts
 * a property of the *source text* rather than of runtime behaviour, because the
 * defect it exists to prevent is invisible to `tsc`, to ESLint and to every
 * behavioural test here. `1137d3e` took `HomeProcessSection`,
 * `HomeCommunitySection` and `HomeGalleryHeader` out of `src/app/page.tsx` and
 * left four links pointing into their anchors. Each one landed at the top of
 * `/` with nothing to scroll to, for sixteen days, and nothing went red.
 *
 * **Why this walks down from a page rather than grepping for the id.** A grep
 * for `id="support"` finds it in `HomeSections.tsx` whether or not anything
 * mounts the component declaring it — the mistake recorded in
 * `tasks/lessons/2026-09-18-a-grep-for-an-anchor-id-proves-it-is-declared-not-rendered.md`.
 * So ids are attributed to the *component* that declares them, and only
 * components reachable from that route's `page.tsx` contribute.
 *
 * **Every route, not just `/`.** An earlier version of this file matched only
 * `"/#id"`. That left `/get-involved#volunteer` — the link the fix for
 * `tasks/decisions/2026-09-22-home-anchors-remount-the-process-section-and-repoint-support.md`
 * *created* —
 * outside its own coverage, along with four more in `Navbar.tsx`. A guard that
 * does not cover the fix that produced it is half a guard.
 *
 * ceiling: the walk does not evaluate conditionals, so an id inside a
 * `{showFilters && …}` block, or on a dialog that opens on click, counts as
 * rendered. That over-accepts: it can pass a link the page would not in fact
 * scroll to. It cannot miss a component that is mounted nowhere, which is the
 * defect here. Narrow it by evaluating the guards, not by listing components —
 * hardcoding a component list reintroduces the declared-versus-rendered gap.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");
const APP = join(SRC, "app");

/**
 * Raw elements an `#id` can sensibly scroll to.
 *
 * An allowlist rather than a denylist, because most ids in this tree belong to
 * form controls — and they are written on wrappers like `<Input id=…>`, so
 * excluding `input` by name would miss them and the guard would accept
 * `/#donorEmail`. Every anchor the site actually uses sits on a `<section>`.
 * An anchor added to a `<span>` is reported as unresolved; move it to a
 * landmark, or add the element here.
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

const ID_ATTRIBUTE = /\bid=["']([A-Za-z0-9_-]+)["']/g;
const RENDERED_COMPONENT = /<([A-Z]\w*)/g;

/**
 * Blanks out comments, keeping the file's line count and every line's length.
 *
 * Without this, commenting a mount out still counts it as rendered: the exact
 * defect this file guards, passing silently. Three commented-out JSX blocks
 * exist in this tree today, in `HomeSections.tsx` and `Hero.tsx`, so it is
 * load-bearing rather than theoretical.
 */
function stripComments(text: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  return (
    text
      // Comment bodies become blanks rather than vanishing. `anchorLinks`
      // splits on newlines afterwards, and deleting the text outright shifted
      // every reported line number by the comment lines above it — a guard
      // whose whole value is naming where the broken link sits must not
      // misname it by 33 lines, into a different component.
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      // A line comment counts only where the slashes open a token: at the
      // start of a line, or after whitespace. That spares every `https://` in
      // a JSX attribute, whose slashes follow a colon, while still blanking a
      // mount someone commented out with `//` — which the block-comment pass
      // alone let through, leaving the same hole it was written to close.
      .replace(/(^|\s)\/\/[^\n]*/gm, (match, lead: string) => lead + blank(match.slice(lead.length)))
  );
}

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

/** name -> file, for every import in `text` that resolves into `src`. */
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

  // Default imports too. Nothing under `src/app` uses this shape for a
  // component today, but nothing forbids it, and a missed import means the
  // walk never enters the component — reporting a working link as broken.
  // A false red is worse than a miss here: it pressures the next person to
  // loosen the guard rather than fix the parser.
  const byDefault = /import\s+([A-Z]\w*)\s*(?:,\s*\{[^}]*\}\s*)?from\s+["']([^"']+)["']/g;
  for (const [, name, specifier] of text.matchAll(byDefault)) {
    const file = resolveImport(specifier, fromFile);
    if (file) map.set(name, file);
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

/** The JSX tag an `id=` sits on — the nearest `<tag` before it. */
function owningTag(body: string, idIndex: number): string {
  const open = body.lastIndexOf("<", idIndex);
  if (open === -1) return "";
  return /^<\s*([A-Za-z][\w.-]*)/.exec(body.slice(open, idIndex))?.[1] ?? "";
}

/** `""` -> `src/app/page.tsx`; `"get-involved"` -> `src/app/get-involved/page.tsx`. */
function pageForRoute(route: string): string | null {
  const file = join(APP, ...route.split("/").filter(Boolean), "page.tsx");
  return existsSync(file) ? file : null;
}

/**
 * The page, plus every `layout.tsx` wrapping it.
 *
 * A route renders more than its own page. `src/app/layout.tsx` mounts `Navbar`
 * and `Footer` on every route, so an id declared in the footer is on screen
 * everywhere — and a walk that started at `page.tsx` alone would call a link
 * to it broken. That false red is the worst failure this guard has, because
 * the natural response to one is to weaken the guard.
 */
function entriesForRoute(route: string): string[] {
  const page = pageForRoute(route);
  if (!page) return [];
  const segments = route.split("/").filter(Boolean);
  const layouts: string[] = [];
  for (let depth = 0; depth <= segments.length; depth += 1) {
    const layout = join(APP, ...segments.slice(0, depth), "layout.tsx");
    if (existsSync(layout)) layouts.push(layout);
  }
  return [page, ...layouts];
}

/** Ids rendered by a route, walking down from each of its entry files. */
function idsRenderedBy(entries: string | string[]): Set<string> {
  const roots = typeof entries === "string" ? [entries] : entries;
  const ids = new Set<string>();
  const seen = new Set<string>();

  function visit(file: string, source: string) {
    const text = stripComments(readFileSync(file, "utf8"));
    const imports = importMap(text, file);
    const blocks = componentBlocks(text);
    // An entry file is one component, so its whole text is its body.
    // Elsewhere, only the named component's block counts.
    const body = roots.includes(file) ? text : (blocks.get(source) ?? "");
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

  for (const root of roots) visit(root, "RouteEntry");
  return ids;
}

interface AnchorLink {
  file: string;
  line: number;
  route: string;
  id: string;
  href: string;
}

/**
 * Every in-app `#anchor` link anywhere under `src`.
 *
 * Matches an href that starts at the app root, so `https://…#frag` and a bare
 * `#id` (which resolves against whatever page is showing) are both out of
 * scope — this guard is about links that name a route and an anchor together.
 *
 * ceiling: a route interpolated into a template literal (`` `/pets/${id}#x` ``)
 * is skipped, because the route cannot be known without running the code. A
 * query string before the fragment IS matched, and the query is discarded
 * before resolving the route.
 */
function anchorLinks(): AnchorLink[] {
  const found: AnchorLink[] = [];
  for (const file of sourceFiles()) {
    stripComments(readFileSync(file, "utf8"))
      .split(/\r?\n/)
      .forEach((text, i) => {
        for (const [, path, id] of text.matchAll(
          /["'`]\/([A-Za-z0-9/_.=&?-]*)#([A-Za-z0-9_-]+)/g,
        )) {
          const route = path.split("?")[0].replace(/\/$/, "");
          found.push({
            file: relative(ROOT, file).split(sep).join("/"),
            line: i + 1,
            route,
            id,
            href: `/${path}#${id}`,
          });
        }
      });
  }
  return found;
}

describe("in-app anchor links", () => {
  it("walks a page's render tree rather than the whole source", () => {
    // Anchors the walker itself. Without this, a bug that returned every id in
    // the repo — or none — would make the real assertion below vacuous.
    const home = idsRenderedBy(entriesForRoute(""));

    expect(home).toContain("our-work");
    expect(home).toContain("adopt");
    expect(home).toContain("mission");
    expect(home).toContain("how-it-works");

    // `#support` is declared nowhere now. `#volunteer` is declared on
    // `/get-involved`, a page the home tree does not reach — so a walk that
    // reads files instead of following renders would wrongly find it here.
    expect(home).not.toContain("support");
    expect(home).not.toContain("volunteer");

    const getInvolved = idsRenderedBy(entriesForRoute("get-involved"));
    expect(getInvolved).toContain("volunteer");
    expect(getInvolved).toContain("foster");
    expect(getInvolved).not.toContain("how-it-works");
  });

  it("does not count a commented-out mount as rendered", () => {
    // Exercised through `idsRenderedBy`, not against `stripComments` directly.
    // A first version of this case asserted on the helper's output, and
    // deleting the helper's call inside the walk left every test in this file
    // green — the guard silently reverted to the behaviour this case is named
    // for. Asserting on a helper proves the helper, not the thing that uses it.
    const fixtures = mkdtempSync(join(tmpdir(), "anchor-guard-"));
    try {
      const page = join(fixtures, "page.tsx");
      writeFileSync(
        page,
        [
          'import { Live, Dead } from "./sections";',
          "export default function Page() {",
          "  return (",
          "    <main>",
          "      <Live />",
          "      {/* <Dead /> */}",
          "      // <Dead />",
          "    </main>",
          "  );",
          "}",
        ].join("\n"),
      );
      writeFileSync(
        join(fixtures, "sections.tsx"),
        [
          "export function Live() {",
          '  return <section id="live-anchor" />;',
          "}",
          "export function Dead() {",
          '  return <section id="dead-anchor" />;',
          "}",
        ].join("\n"),
      );

      const ids = idsRenderedBy(page);
      expect(ids).toContain("live-anchor");
      // Commented out both ways a mount can be commented out.
      expect(ids).not.toContain("dead-anchor");
    } finally {
      rmSync(fixtures, { recursive: true, force: true });
    }
  });

  it("reports the line the broken link is actually written on", () => {
    // Comment bodies are blanked rather than deleted. When they were deleted,
    // a link in `HomeSections.tsx` was reported 33 lines above its real
    // position, inside a different component — the guard's only diagnostic
    // output, pointing somewhere else.
    const source = readFileSync(join(SRC, "components", "layout", "Footer.tsx"), "utf8");
    const stripped = stripComments(source);

    expect(stripped.split("\n")).toHaveLength(source.split("\n").length);

    const realLine = source
      .split(/\r?\n/)
      .findIndex((line) => line.includes('"/get-involved#volunteer"'));
    const strippedLine = stripped
      .split(/\r?\n/)
      .findIndex((line) => line.includes('"/get-involved#volunteer"'));
    expect(realLine).toBeGreaterThan(-1);
    expect(strippedLine).toBe(realLine);
  });

  it("points every in-app anchor link at an id that route renders", () => {
    const idsByRoute = new Map<string, Set<string> | null>();
    const unresolved = anchorLinks().filter((link) => {
      if (!idsByRoute.has(link.route)) {
        const entries = entriesForRoute(link.route);
        idsByRoute.set(link.route, entries.length ? idsRenderedBy(entries) : null);
      }
      return !idsByRoute.get(link.route)?.has(link.id);
    });

    const rendered = [...idsByRoute]
      .map(([route, ids]) => `/${route} -> ${ids ? [...ids].sort().join(", ") : "NO page.tsx"}`)
      .join("\n  ");

    expect(
      unresolved.map((u) => `${u.file}:${u.line} -> ${u.href}`),
      `routes reached by an anchor link:\n  ${rendered}`,
    ).toEqual([]);
  });
});
