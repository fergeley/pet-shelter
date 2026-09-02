import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = new Map<string, { name: string; value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      if (options?.maxAge === 0) cookieStore.delete(name);
      else cookieStore.set(name, { name, value });
    },
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  registerSponsorAction,
  sponsorLoginAction,
  sponsorLogoutAction,
  updateWallPreferenceAction,
  submitCaretakerQuestionAction,
} from "@/actions/sponsors";
import { SPONSOR_SESSION_COOKIE_NAME } from "@/lib/security/sponsorSession";
import { SESSION_COOKIE_NAME } from "@/lib/security/session";
import { getSponsorDashboard, getSponsorWall } from "@/lib/domain/sponsorAccess";
import { __resetSponsorStoreForTests } from "@/lib/sponsorStore";
import { resetRateLimitStore } from "@/lib/security/rateLimit";

/** Seeded pledge that no account has claimed yet. */
const UNCLAIMED = {
  email: "unclaimed@example.com",
  name: "Tan Wei Ming",
  receiptNumber: "HFS-DON-202607-6600",
};

const STRONG_PASSWORD = "correct-horse-battery";

describe("Sponsor registration", () => {
  beforeEach(async () => {
    cookieStore.clear();
    await __resetSponsorStoreForTests();
    resetRateLimitStore();
  });

  it("claims an unattached pledge when the receipt number matches the email", async () => {
    const result = await registerSponsorAction({
      name: UNCLAIMED.name,
      email: UNCLAIMED.email,
      password: STRONG_PASSWORD,
      receiptNumber: UNCLAIMED.receiptNumber,
      displayOnWall: false,
    });

    expect(result.success).toBe(true);
    expect(result.linkedContributions).toBe(1);
    expect(cookieStore.has(SPONSOR_SESSION_COOKIE_NAME)).toBe(true);

    const dashboard = await getSponsorDashboard();
    expect(dashboard!.name).toBe(UNCLAIMED.name);
    expect(dashboard!.rescues.map((rescue) => rescue.petId)).toContain("pet-001");
  });

  it("refuses a receipt number that belongs to a different donor", async () => {
    // The whole point of the challenge: without it, registering with someone else's
    // address would hand over their standing, their rescues and their gated media.
    const result = await registerSponsorAction({
      name: "Impostor",
      email: "impostor@example.com",
      password: STRONG_PASSWORD,
      receiptNumber: UNCLAIMED.receiptNumber,
      displayOnWall: false,
    });

    expect(result.success).toBe(false);
    expect(cookieStore.has(SPONSOR_SESSION_COOKIE_NAME)).toBe(false);
  });

  it("refuses a receipt number that does not exist", async () => {
    const result = await registerSponsorAction({
      name: "Nobody",
      email: "nobody@example.com",
      password: STRONG_PASSWORD,
      receiptNumber: "HFS-DON-209912-0001",
      displayOnWall: false,
    });

    expect(result.success).toBe(false);
  });

  it("gives the same message for a missing receipt and a mismatched one", async () => {
    // Distinct messages would turn the form into a receipt-number oracle.
    const missing = await registerSponsorAction({
      name: "Nobody",
      email: "nobody@example.com",
      password: STRONG_PASSWORD,
      receiptNumber: "HFS-DON-209912-0001",
      displayOnWall: false,
    });
    const mismatched = await registerSponsorAction({
      name: "Impostor",
      email: "impostor@example.com",
      password: STRONG_PASSWORD,
      receiptNumber: UNCLAIMED.receiptNumber,
      displayOnWall: false,
    });

    expect(missing.error).toBe(mismatched.error);
  });

  it("rejects a malformed receipt number before any lookup", async () => {
    const result = await registerSponsorAction({
      name: UNCLAIMED.name,
      email: UNCLAIMED.email,
      password: STRONG_PASSWORD,
      receiptNumber: "not-a-receipt",
      displayOnWall: false,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password under ten characters", async () => {
    const result = await registerSponsorAction({
      name: UNCLAIMED.name,
      email: UNCLAIMED.email,
      password: "short",
      receiptNumber: UNCLAIMED.receiptNumber,
      displayOnWall: false,
    });

    expect(result.success).toBe(false);
  });

  it("refuses to register an email that already has an account", async () => {
    const result = await registerSponsorAction({
      name: "Nurul Aisyah",
      email: "bronze@example.com",
      password: STRONG_PASSWORD,
      receiptNumber: "HFS-DON-202603-1041",
      displayOnWall: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
  });

  it("inherits the Sponsor Wall consent given at checkout", async () => {
    // The seeded unclaimed pledge was made with the wall box ticked, and the claim form
    // left unticked. Consent belongs to the donor, so it must survive the claim.
    const result = await registerSponsorAction({
      name: UNCLAIMED.name,
      email: UNCLAIMED.email,
      password: STRONG_PASSWORD,
      receiptNumber: UNCLAIMED.receiptNumber,
      displayOnWall: false,
    });

    expect(result.success).toBe(true);
    expect((await getSponsorDashboard())!.displayOnWall).toBe(true);
  });
});

describe("Sponsor login", () => {
  beforeEach(async () => {
    cookieStore.clear();
    await __resetSponsorStoreForTests();
    resetRateLimitStore();
  });

  it("signs in a seeded sponsor with the right password", async () => {
    const result = await sponsorLoginAction({
      email: "silver@example.com",
      password: "silver123",
    });

    expect(result.success).toBe(true);
    expect(cookieStore.has(SPONSOR_SESSION_COOKIE_NAME)).toBe(true);
    expect((await getSponsorDashboard())!.tier).toBe("SILVER");
  });

  it("does NOT accept the staff development password '1234'", async () => {
    // `loginAction` in @/actions/auth accepts "1234" for any staff account. Sponsor
    // authentication deliberately does not go through that code path, and this test is
    // what stops the backdoor being reintroduced by a future refactor that "unifies" them.
    const result = await sponsorLoginAction({
      email: "gold@example.com",
      password: "1234",
    });

    expect(result.success).toBe(false);
    expect(cookieStore.has(SPONSOR_SESSION_COOKIE_NAME)).toBe(false);
  });

  it("rejects a wrong password with the same message as an unknown email", async () => {
    const wrongPassword = await sponsorLoginAction({
      email: "gold@example.com",
      password: "definitely-not-it",
    });
    const unknownEmail = await sponsorLoginAction({
      email: "no-such-sponsor@example.com",
      password: "definitely-not-it",
    });

    expect(wrongPassword.success).toBe(false);
    expect(unknownEmail.success).toBe(false);
    expect(wrongPassword.error).toBe(unknownEmail.error);
  });

  it("rate limits repeated sign-in attempts", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sponsorLoginAction({ email: "gold@example.com", password: "wrong" });
    }

    const limited = await sponsorLoginAction({
      email: "gold@example.com",
      password: "gold123",
    });

    expect(limited.success).toBe(false);
    expect(limited.error).toContain("Too many");
  });

  it("clears the sponsor session on sign out", async () => {
    await sponsorLoginAction({ email: "gold@example.com", password: "gold123" });
    expect(cookieStore.has(SPONSOR_SESSION_COOKIE_NAME)).toBe(true);

    await sponsorLogoutAction();
    expect(cookieStore.has(SPONSOR_SESSION_COOKIE_NAME)).toBe(false);
    expect(await getSponsorDashboard()).toBeNull();
  });

  it("uses a different cookie from the staff session", async () => {
    await sponsorLoginAction({ email: "gold@example.com", password: "gold123" });

    expect(SPONSOR_SESSION_COOKIE_NAME).not.toBe(SESSION_COOKIE_NAME);
    expect(cookieStore.has(SESSION_COOKIE_NAME)).toBe(false);
  });
});

describe("Sponsor Wall preference", () => {
  beforeEach(async () => {
    cookieStore.clear();
    await __resetSponsorStoreForTests();
    resetRateLimitStore();
  });

  it("refuses to change a preference for a signed-out visitor", async () => {
    const result = await updateWallPreferenceAction(true);
    expect(result.success).toBe(false);
  });

  it("removes a sponsor from the wall when they opt out", async () => {
    await sponsorLoginAction({ email: "gold@example.com", password: "gold123" });

    expect((await getSponsorWall()).GOLD.map((e) => e.name)).toContain(
      "Datin Sofia Rahman"
    );

    await updateWallPreferenceAction(false);

    expect((await getSponsorWall()).GOLD.map((e) => e.name)).not.toContain(
      "Datin Sofia Rahman"
    );
  });
});

describe("Caretaker Q&A (Gold privilege)", () => {
  beforeEach(async () => {
    cookieStore.clear();
    await __resetSponsorStoreForTests();
    resetRateLimitStore();
  });

  it("refuses a signed-out caller", async () => {
    const result = await submitCaretakerQuestionAction(
      "How is Luna's recovery going this week?"
    );
    expect(result.success).toBe(false);
  });

  it("refuses a Silver sponsor even though the action is reachable", async () => {
    // The Server Action is a public endpoint. Rendering the form behind <TierGate> stops
    // nobody who calls it directly, so authorization has to live in the action itself.
    await sponsorLoginAction({ email: "silver@example.com", password: "silver123" });

    const result = await submitCaretakerQuestionAction(
      "How is Bella's recovery going this week?"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Gold");
  });

  it("accepts a question from a Gold sponsor", async () => {
    await sponsorLoginAction({ email: "gold@example.com", password: "gold123" });

    const result = await submitCaretakerQuestionAction(
      "How is Luna's hydrotherapy progressing?"
    );

    expect(result.success).toBe(true);
  });

  it("rejects an empty or oversized message from a Gold sponsor", async () => {
    await sponsorLoginAction({ email: "gold@example.com", password: "gold123" });

    expect((await submitCaretakerQuestionAction("hi")).success).toBe(false);
    expect((await submitCaretakerQuestionAction("x".repeat(2001))).success).toBe(false);
  });
});
