import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
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
 * `nav-links-point-at-home-sections-the-page-no-longer-renders.md` *created* —
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
 * Removes block comments, which is also the form a JSX comment takes — the
 * braces around one are left behind as a harmless empty expression.
 *
 * Without this, commenting a mount out still counts it as rendered: the exact
 * defect this file guards, passing silently. Three commented-out JSX blocks
 * exist in this tree today, in `HomeSections.tsx` and `Hero.tsx`, so the
 * stripping is load-bearing rather than theoretical.
 *
 * Line comments are deliberately NOT removed: a double slash occurs inside
 * every `https://` URL written in a JSX attribute, and cutting from there to
 * end-of-line would corrupt the text this guard reads.
 */
function stripBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
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

/** Ids rendered by a route, walking down from its `page.tsx`. */
function idsRenderedBy(entry: string): Set<string> {
  const ids = new Set<string>();
  const seen = new Set<string>();

  function visit(file: string, source: string) {
    const text = stripBlockComments(readFileSync(file, "utf8"));
    const imports = importMap(text, file);
    const blocks = componentBlocks(text);
    // The entry is one component, so its whole text is its body. Elsewhere,
    // only the named component's block counts.
    const body = file === entry ? text : (blocks.get(source) ?? "");
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

  visit(entry, "PageEntry");
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
 */
function anchorLinks(): AnchorLink[] {
  const found: AnchorLink[] = [];
  for (const file of sourceFiles()) {
    stripBlockComments(readFileSync(file, "utf8"))
      .split(/\r?\n/)
      .forEach((text, i) => {
        for (const [, route, id] of text.matchAll(
          /["'`]\/([A-Za-z0-9/_-]*)#([A-Za-z0-9_-]+)/g,
        )) {
          found.push({
            file: relative(ROOT, file).split(sep).join("/"),
            line: i + 1,
            route,
            id,
            href: `/${route}#${id}`,
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
    const home = idsRenderedBy(pageForRoute("")!);

    expect(home).toContain("our-work");
    expect(home).toContain("adopt");
    expect(home).toContain("mission");
    expect(home).toContain("how-it-works");

    // `#support` is declared nowhere now. `#volunteer` is declared on
    // `/get-involved`, a page the home tree does not reach — so a walk that
    // reads files instead of following renders would wrongly find it here.
    expect(home).not.toContain("support");
    expect(home).not.toContain("volunteer");

    const getInvolved = idsRenderedBy(pageForRoute("get-involved")!);
    expect(getInvolved).toContain("volunteer");
    expect(getInvolved).toContain("foster");
    expect(getInvolved).not.toContain("how-it-works");
  });

  it("does not count a commented-out mount as rendered", () => {
    // `{/* <HomeProcessSection /> */}` must not keep `#how-it-works` alive.
    // Three commented-out JSX blocks exist in this tree already, so the
    // stripping this relies on is load-bearing rather than theoretical.
    const page = readFileSync(pageForRoute("")!, "utf8");
    expect(page).toContain("<HomeProcessSection />");

    const commentedOut = stripBlockComments(
      page.replace("<HomeProcessSection />", "{/* <HomeProcessSection /> */}"),
    );
    // The JSX usage is what `RENDERED_COMPONENT` matches and what the walk
    // follows; the import line survives, and should, because an unused import
    // is ESLint's problem rather than this guard's.
    expect(commentedOut).not.toMatch(/<HomeProcessSection/);
    expect(commentedOut).toContain("HomeProcessSection,");
  });

  it("points every in-app anchor link at an id that route renders", () => {
    const idsByRoute = new Map<string, Set<string> | null>();
    const unresolved = anchorLinks().filter((link) => {
      if (!idsByRoute.has(link.route)) {
        const page = pageForRoute(link.route);
        idsByRoute.set(link.route, page ? idsRenderedBy(page) : null);
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
