import { describe, it, expect, vi, beforeEach } from "vitest";
import { shelterSettingsSchema } from "@/lib/validations/settings";
import {
  isPlaceholderFormUrl,
  isSafeExternalUrl,
  isUsableFormUrl,
  DEFAULT_VOLUNTEER_FORM_URL,
  DEFAULT_VOLUNTEER_FORM_RESPONSES_URL,
} from "@/lib/volunteerFormUrl";

/**
 * The volunteer application link is admin-configurable and rendered straight into an
 * `href` on a public page, so the guards here matter more than the plumbing: a bad
 * value becomes either a dead primary CTA or a script URL.
 *
 * The page itself is a Server Component and is deliberately not rendered here — see
 * the "Server Component / jsdom Trap" note in vitest.config.mts. Its markup is
 * verified against a running server instead.
 */

const sessionState = vi.hoisted(() => ({
  id: "user-test-01",
  email: "coordinator@hopeforstrays.org",
  role: "ADMIN" as string,
  signedOut: false,
}));

vi.mock("@/lib/security/session", () => ({
  getCurrentSession: vi.fn(async () =>
    sessionState.signedOut
      ? null
      : { id: sessionState.id, email: sessionState.email, role: sessionState.role }
  ),
}));

const BASE_SETTINGS = {
  shelterName: "Hope for Strays",
  email: "info@hopeforstrays.org",
  phone: "03-7876 5432",
  address: "No. 18, Jalan SS 2/72, 47300 Petaling Jaya",
  operatingHours: "Tuesday – Sunday: 10:00 AM – 5:00 PM",
  adoptionFeeDog: "Free",
  adoptionFeeCat: "Free",
};

const REAL_FORM_URL = "https://forms.gle/HopeForStraysVolunteer2026";

beforeEach(() => {
  vi.clearAllMocks();
  sessionState.role = "ADMIN";
  sessionState.signedOut = false;
});

describe("volunteer form URL validation", () => {
  it("accepts a valid form URL", () => {
    const result = shelterSettingsSchema.safeParse({
      ...BASE_SETTINGS,
      volunteerFormUrl: REAL_FORM_URL,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.volunteerFormUrl).toBe(REAL_FORM_URL);
  });

  it("rejects a value that is not a URL", () => {
    const result = shelterSettingsSchema.safeParse({
      ...BASE_SETTINGS,
      volunteerFormUrl: "forms.google.com/not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("rejects javascript: and data: URLs that would become an XSS href", () => {
    // Zod's z.url() accepts both; only the pinned protocol stops them.
    for (const hostile of [
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
    ]) {
      const result = shelterSettingsSchema.safeParse({
        ...BASE_SETTINGS,
        volunteerFormUrl: hostile,
      });
      expect(result.success, `${hostile} must be rejected`).toBe(false);
    }
  });

  it("accepts an empty string so a configured URL can be cleared again", () => {
    // An emptied react-hook-form input submits "", not undefined, so ZodDefault
    // never fires; without the empty-string branch this would block the whole form.
    const result = shelterSettingsSchema.safeParse({
      ...BASE_SETTINGS,
      volunteerFormUrl: "",
      volunteerFormResponsesUrl: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.volunteerFormUrl).toBe("");
      expect(isPlaceholderFormUrl(result.data.volunteerFormUrl)).toBe(true);
    }
  });

  it("applies shipped defaults so existing settings payloads keep parsing", () => {
    const result = shelterSettingsSchema.safeParse(BASE_SETTINGS);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.volunteerFormUrl).toBe(DEFAULT_VOLUNTEER_FORM_URL);
      expect(result.data.volunteerFormResponsesUrl).toBe(
        DEFAULT_VOLUNTEER_FORM_RESPONSES_URL
      );
    }
  });
});

describe("URL guards", () => {
  it("treats the shipped placeholders, blanks and nullish values as unconfigured", () => {
    expect(isPlaceholderFormUrl(DEFAULT_VOLUNTEER_FORM_URL)).toBe(true);
    expect(isPlaceholderFormUrl(DEFAULT_VOLUNTEER_FORM_RESPONSES_URL)).toBe(true);
    expect(isPlaceholderFormUrl("")).toBe(true);
    expect(isPlaceholderFormUrl("   ")).toBe(true);
    expect(isPlaceholderFormUrl(undefined)).toBe(true);
    expect(isPlaceholderFormUrl(null)).toBe(true);
    expect(isPlaceholderFormUrl(REAL_FORM_URL)).toBe(false);
  });

  it("only accepts http(s) as a safe external URL", () => {
    expect(isSafeExternalUrl("https://forms.gle/x")).toBe(true);
    expect(isSafeExternalUrl("http://forms.gle/x")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,x")).toBe(false);
    expect(isSafeExternalUrl("")).toBe(false);
  });

  it("is renderable only when configured and http(s)", () => {
    expect(isUsableFormUrl(REAL_FORM_URL)).toBe(true);
    expect(isUsableFormUrl(DEFAULT_VOLUNTEER_FORM_URL)).toBe(false);
    expect(isUsableFormUrl("javascript:alert(1)")).toBe(false);
    expect(isUsableFormUrl("")).toBe(false);
  });
});

describe("settings repository round trip", () => {
  it("defaults both volunteer links to the shipped placeholders", async () => {
    const { getServerSettingsAsync } = await import("@/lib/server/settingsRepository");

    const settings = await getServerSettingsAsync();
    expect(settings.volunteerFormUrl).toBe(DEFAULT_VOLUNTEER_FORM_URL);
    expect(settings.volunteerFormResponsesUrl).toBe(DEFAULT_VOLUNTEER_FORM_RESPONSES_URL);
  });

  it("persists a saved form URL and reads it back", async () => {
    const { getServerSettingsAsync, updateServerSettings } = await import(
      "@/lib/server/settingsRepository"
    );

    await updateServerSettings({ ...BASE_SETTINGS, volunteerFormUrl: REAL_FORM_URL });

    const settings = await getServerSettingsAsync();
    expect(settings.volunteerFormUrl).toBe(REAL_FORM_URL);
  });
});

describe("getVolunteerFormLinks", () => {
  it("returns only the two links, never the credentials beside them", async () => {
    const { getVolunteerFormLinks } = await import("@/actions/settings");
    sessionState.role = "COORDINATOR";

    const links = await getVolunteerFormLinks();

    expect(Object.keys(links).sort()).toEqual([
      "volunteerFormResponsesUrl",
      "volunteerFormUrl",
    ]);
    expect(JSON.stringify(links)).not.toMatch(/resendApiKey|s3Bucket|cloudinary/i);
  });

  it("serves ADMIN and COORDINATOR", async () => {
    const { getVolunteerFormLinks } = await import("@/actions/settings");

    for (const role of ["ADMIN", "COORDINATOR"]) {
      sessionState.role = role;
      await expect(getVolunteerFormLinks()).resolves.toHaveProperty("volunteerFormUrl");
    }
  });

  it("refuses STAFF, VOLUNTEER and anonymous callers", async () => {
    const { getVolunteerFormLinks } = await import("@/actions/settings");

    for (const role of ["STAFF", "VOLUNTEER"]) {
      sessionState.role = role;
      await expect(getVolunteerFormLinks()).rejects.toThrow(/not authorized/i);
    }

    sessionState.signedOut = true;
    await expect(getVolunteerFormLinks()).rejects.toThrow(/Authentication required/i);
  });

  it("reflects a newly saved responses sheet URL", async () => {
    const { updateServerSettings } = await import("@/lib/server/settingsRepository");
    const { getVolunteerFormLinks } = await import("@/actions/settings");
    const sheet = "https://docs.google.com/spreadsheets/d/RealSheet/edit";

    await updateServerSettings({
      ...BASE_SETTINGS,
      volunteerFormResponsesUrl: sheet,
    });

    sessionState.role = "ADMIN";
    await expect(getVolunteerFormLinks()).resolves.toMatchObject({
      volunteerFormResponsesUrl: sheet,
    });
  });
});
