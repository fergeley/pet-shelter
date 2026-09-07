import Link from "next/link";
import { getPublicPets } from "@/actions/pets";
import { HeroFullBleed, HeroScatter, HeroPetStrip } from "@/components/layout/HeroVariants";
import {
  WorkA, WorkB, WorkC,
  JoinA, JoinB, JoinC, JoinD,
  StandardsA, StandardsB, StandardsC,
} from "@/components/layout/SectionVariants";

/**
 * Throwaway comparison route. Each section carries three candidate layouts over the same
 * copy, chosen independently through the query string, so a whole page can be assembled
 * from one combination and judged as a page rather than as a gallery of fragments.
 * Delete this directory, `HeroVariants.tsx` and `SectionVariants.tsx` once decided.
 */

type Key = "a" | "b" | "c" | "d";

const GROUPS = [
  { param: "hero", label: "Hero", options: { a: "Full-bleed photo", b: "Scattered images", c: "Live pet strip" } },
  { param: "work", label: "Our Work", options: { a: "Image cards", b: "Editorial rows", c: "Typographic index" } },
  { param: "join", label: "Join us", options: { a: "Image cards", b: "Quiet list", c: "Asymmetric overlay", d: "Asymmetric cards" } },
  { param: "std", label: "Standards", options: { a: "Split column", b: "Centred + 4-up", c: "Definition list" } },
] as const;

function pick(param: string, value: string | undefined): Key {
  const group = GROUPS.find((g) => g.param === param);
  return group && value && value in group.options ? (value as Key) : "a";
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const sel: Record<string, Key> = {
    hero: pick("hero", sp.hero),
    work: pick("work", sp.work),
    join: pick("join", sp.join),
    std: pick("std", sp.std),
  };
  const pets = await getPublicPets();
  const href = (param: string, key: Key) =>
    "/preview?" + new URLSearchParams({ ...sel, [param]: key }).toString();

  return (
    <div className="flex flex-col">
      <div className="sticky top-16 z-30 border-b border-border bg-work-panel/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
          {GROUPS.map((g) => (
            <div key={g.param} className="flex items-center gap-2">
              <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{g.label}</span>
              {(Object.entries(g.options) as [Key, string][]).map(([k, label]) => (
                <Link
                  key={k}
                  href={href(g.param, k)}
                  title={label}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                    sel[g.param] === k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      {sel.hero === "a" && <HeroFullBleed />}
      {sel.hero === "b" && <HeroScatter />}
      {sel.hero === "c" && <HeroPetStrip pets={pets} />}

      {sel.work === "a" && <WorkA />}
      {sel.work === "b" && <WorkB />}
      {sel.work === "c" && <WorkC />}

      {sel.join === "a" && <JoinA />}
      {sel.join === "b" && <JoinB />}
      {sel.join === "c" && <JoinC />}
      {sel.join === "d" && <JoinD />}

      {sel.std === "a" && <StandardsA />}
      {sel.std === "b" && <StandardsB />}
      {sel.std === "c" && <StandardsC />}
    </div>
  );
}
