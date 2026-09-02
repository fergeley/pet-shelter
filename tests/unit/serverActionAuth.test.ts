import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every exported function in a `"use server"` module is an HTTP POST endpoint
 * whose action id ships in the client bundle. Anyone can call it.
 *
 * This is not theoretical here: `loadShelterSettings` and `getShelterSettings`
 * were both added as innocuous "read helpers" and both returned the entire
 * shelter settings object — `resendApiKey` included — to any caller. The
 * authorization reflex fires on mutations, so a read slipped past it twice.
 *
 * This guard makes that a deliberate choice rather than an oversight: a new
 * action either performs an authorization check or is listed below with a
 * reason. It cannot be silently neither.
 */

const ACTIONS_DIR = join(process.cwd(), "src", "actions");

/** Helpers that establish the caller is allowed to proceed. */
const AUTH_TOKENS = [
  "assertAuthorized",
  "verifyAdminSession",
  "getAdminActorOrThrow",
  // Named per-feature gates that call assertAuthorized internally.
  "requireFaqEditor",
];

/**
 * Actions that are reachable without a session, each for a stated reason.
 *
 * Adding a name here is a security decision. It means "a stranger may call
 * this", so the response must contain nothing a stranger should not see.
 */
const INTENTIONALLY_PUBLIC: Record<string, string> = {
  // Authentication itself cannot require a session.
  loginAction: "establishes the session",
  registerAction: "account creation",
  logoutAction: "clears the session; safe for anyone",
  getCurrentUserAction: "returns the caller's own session or null",

  // Public-facing submissions from visitors who are not staff.
  submitApplication: "adoption applications come from the public",
  lookupApplicationStatusAction:
    "applicants check their own status; rate-limited and keyed on their reference",
  submitDonationPledgeAction: "donations come from the public",

  // The public catalog. Both filter to non-archived pets.
  getPublicPets: "public adoption catalog",
  getPets: "alias of getPublicPets",

  // Public content, served on pages any visitor can open. Pre-existing on
  // master and not touched by this change: listed so the guard passes on
  // today's tree, with their payloads not audited field by field here.
  getFaqsAction: "published rows only, rendered anonymously by /faq and /pets",
  fetchFaqsAction: "alias of getFaqsAction",
  getFaqByIdAction: "published rows only, rendered anonymously",
  getRehabNeedsAction: "public rehabilitation needs list",
  fetchRehabNeedsAction: "alias of getRehabNeedsAction",
  getRehabNeedByIdAction: "public rehabilitation need",

  // Sponsorship is a public donation flow, like submitDonationPledgeAction.
  createPetSponsorshipAction: "donors sponsor without an account",
  getPetSponsorshipSummaryAction: "public progress totals shown on pet pages",

  // Delegates to an authorized action rather than checking inline.
  deletePet: "calls toggleArchivePet, which authorizes",

};

interface ActionExport {
  file: string;
  name: string;
  body: string;
}

function collectServerActions(): ActionExport[] {
  const found: ActionExport[] = [];

  for (const file of readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(join(ACTIONS_DIR, file), "utf8");
    if (!/^\s*["']use server["']/m.test(source)) continue;

    const pattern = /^export\s+async\s+function\s+([A-Za-z0-9_]+)/gm;
    const starts: Array<{ name: string; index: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      starts.push({ name: match[1], index: match.index });
    }

    starts.forEach((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].index : source.length;
      found.push({ file, name: start.name, body: source.slice(start.index, end) });
    });
  }

  return found;
}

describe("server action authorization", () => {
  const actions = collectServerActions();

  it("finds the server action modules", () => {
    // Guards the extractor itself: a regex that silently matches nothing would
    // make every assertion below vacuously pass.
    expect(actions.length).toBeGreaterThan(10);
    expect(new Set(actions.map((a) => a.file)).size).toBeGreaterThan(3);
  });

  it("every exported action either authorizes or is a documented exception", () => {
    const unguarded = actions
      .filter((a) => !AUTH_TOKENS.some((token) => a.body.includes(token)))
      .filter((a) => !(a.name in INTENTIONALLY_PUBLIC))
      .map((a) => `${a.file}:${a.name}`);

    expect(unguarded).toEqual([]);
  });

  it("keeps the exception list free of names that no longer exist", () => {
    const names = new Set(actions.map((a) => a.name));
    const stale = Object.keys(INTENTIONALLY_PUBLIC).filter((n) => !names.has(n));
    expect(stale).toEqual([]);
  });

  it("does not expose an ungated settings reader", () => {
    // The specific regression: two of these shipped, both returning resendApiKey.
    const settings = actions.filter((a) => a.file === "settings.ts");
    expect(settings.length).toBeGreaterThan(0);
    for (const action of settings) {
      expect(AUTH_TOKENS.some((token) => action.body.includes(token))).toBe(true);
    }
  });
});
