import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Structural guards for the layer boundaries documented in
 * docs/architecture/LAYERS.md.
 *
 * These assert properties of the *import graph*, not of runtime behaviour, so
 * they catch a class of mistake that neither `tsc` nor any behavioural test can
 * see: a server module quietly pulling in client-only code, or the repository
 * boundary leaking outside the three files allowed to talk to Prisma.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");

type Module = {
  isClient: boolean;
  isServer: boolean;
  imports: string[];
};

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

/** Resolves an import specifier to a repo-relative file, or null if external. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(resolve(ROOT, fromFile, ".."), spec);
  else return null; // bare package specifier

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return toRepoPath(candidate);
  }
  return null;
}

function buildGraph(): Record<string, Module> {
  const graph: Record<string, Module> = {};

  for (const file of walk(SRC)) {
    const source = readFileSync(join(ROOT, file), "utf8");
    // Directives are only meaningful at the very top of a module.
    const head = source.slice(0, 400);
    const imports: string[] = [];

    const specifierPattern = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = specifierPattern.exec(source))) imports.push(match[1]);

    graph[file] = {
      isClient: /^\s*["']use client["']/m.test(head),
      isServer: /^\s*["']use server["']/m.test(head),
      imports,
    };
  }

  return graph;
}

/** Every client module transitively reachable from `entry`, with one path to each. */
function reachableClientModules(
  graph: Record<string, Module>,
  entry: string
): Map<string, string> {
  const found = new Map<string, string>();
  const seen = new Set<string>([entry]);
  const queue: string[] = [entry];

  while (queue.length) {
    const current = queue.shift()!;
    for (const spec of graph[current].imports) {
      const target = resolveSpecifier(current, spec);
      if (!target || !graph[target] || seen.has(target)) continue;
      seen.add(target);

      if (graph[target].isClient) found.set(target, current);
      else queue.push(target);
    }
  }

  return found;
}

const graph = buildGraph();

describe("layer boundaries", () => {
  it("finds the modules it is supposed to be checking", () => {
    // Guards the guard: a broken walk or resolver would make every other
    // assertion in this file pass vacuously.
    const files = Object.keys(graph);
    expect(files.length).toBeGreaterThan(50);
    expect(files.filter((f) => graph[f].isServer).length).toBeGreaterThanOrEqual(6);
    expect(files.filter((f) => graph[f].isClient).length).toBeGreaterThanOrEqual(10);
  });

  it("no Server Action transitively imports a \"use client\" module", () => {
    const serverEntries = Object.keys(graph).filter((f) => graph[f].isServer);
    const violations: string[] = [];

    for (const entry of serverEntries) {
      for (const [clientModule, via] of reachableClientModules(graph, entry)) {
        violations.push(
          via === entry
            ? `${entry} imports ${clientModule}`
            : `${entry} reaches ${clientModule} via ${via}`
        );
      }
    }

    expect(
      violations,
      "A \"use server\" module must not reach client-only code. Move the shared " +
        "value into a directive-free module (see src/lib/domain/sponsorshipTiers.ts) " +
        "rather than importing from a \"use client\" file. " +
        "Background: docs/architecture/LAYERS.md §5.1."
    ).toEqual([]);
  });

  it("keeps Prisma access inside the repository layer", () => {
    // The property that makes persistence swappable and lets this suite run
    // without a database. Adding an importer is a design decision:
    // update docs/architecture/LAYERS.md (L-B2) along with this list.
    const allowed = [
      "src/lib/server/petRepository.ts",
      "src/lib/server/applicationRepository.ts",
      "src/lib/userStore.ts",
      "src/lib/domain/auditLog.ts",
      // Repository layer, but deliberately *not* dual-layer: a donation record
      // has no committed fixture to fall back to, so a failed write must fail
      // the request rather than mint an unbacked tax receipt. See L-B2.
      "src/lib/donationLedger.ts",
    ];

    const importers = Object.keys(graph).filter((file) =>
      graph[file].imports.some(
        (spec) => resolveSpecifier(file, spec) === "src/lib/prisma.ts"
      )
    );

    expect(importers.sort()).toEqual([...allowed].sort());
  });

  it("keeps the repository layer out of the browser bundle", () => {
    // `src/lib/server/` is the repository layer: every module there reaches
    // Prisma, the fixture caches, or both. A `"use client"` module importing one
    // pulls the database client into the browser bundle, and no type error says
    // so. Introduced green — see docs/tasks/PLAN_LIB_RESTRUCTURE.md §4.
    const serverModules = Object.keys(graph).filter((f) =>
      f.startsWith("src/lib/server/")
    );

    // Guards the guard: a renamed directory would make the loop below iterate
    // over nothing and pass while enforcing nothing.
    expect(
      serverModules.length,
      "No modules found under src/lib/server/ — has the repository layer moved?"
    ).toBeGreaterThanOrEqual(5);

    const violations: string[] = [];
    for (const file of Object.keys(graph)) {
      if (!graph[file].isClient) continue;
      for (const spec of graph[file].imports) {
        const target = resolveSpecifier(file, spec);
        if (target && serverModules.includes(target)) {
          violations.push(`${file} imports ${target}`);
        }
      }
    }

    expect(
      violations,
      "A \"use client\" module must not import the repository layer. Call a " +
        "Server Action from src/actions/ instead, or lift the value into " +
        "src/lib/domain/. Background: docs/architecture/LAYERS.md §L-B2."
    ).toEqual([]);
  });

  it("keeps the localStorage stores on the client", () => {
    // `src/lib/client/` is L-F4: browser-only React hooks over localStorage.
    // A server module importing one reaches for `window` during SSR. The
    // directory makes the boundary visible; this makes it enforced.
    const clientModules = Object.keys(graph).filter((f) =>
      f.startsWith("src/lib/client/")
    );

    expect(
      clientModules.length,
      "No modules found under src/lib/client/ — has L-F4 moved?"
    ).toBeGreaterThanOrEqual(6);

    const violations: string[] = [];
    for (const file of Object.keys(graph)) {
      if (graph[file].isClient) continue;
      for (const spec of graph[file].imports) {
        const target = resolveSpecifier(file, spec);
        if (target && clientModules.includes(target)) {
          violations.push(`${file} imports ${target}`);
        }
      }
    }

    expect(
      violations,
      "Only a \"use client\" module may import src/lib/client/. These are " +
        "localStorage hooks, not a data source — a server module needs " +
        "src/lib/server/ instead. Background: docs/architecture/LAYERS.md §L-F4."
    ).toEqual([]);
  });

  it("keeps presentation helpers free of the repository layer", () => {
    // Status → tone/badge mapping is a pure function of a domain value. Reaching
    // into a repository from here would make a render path do a database read.
    const presentationModules = Object.keys(graph).filter((f) =>
      f.startsWith("src/lib/presentation/")
    );

    expect(
      presentationModules.length,
      "No modules found under src/lib/presentation/."
    ).toBeGreaterThanOrEqual(2);

    const violations: string[] = [];
    for (const file of presentationModules) {
      for (const spec of graph[file].imports) {
        const target = resolveSpecifier(file, spec);
        if (target && target.startsWith("src/lib/server/")) {
          violations.push(`${file} imports ${target}`);
        }
      }
    }

    expect(
      violations,
      "src/lib/presentation/ must stay pure — it maps a domain value onto a " +
        "tone or label and nothing else. Take the data as a parameter instead " +
        "of fetching it. Background: docs/architecture/LAYERS.md §L-B2."
    ).toEqual([]);
  });
});
