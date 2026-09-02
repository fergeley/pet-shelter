"use server";

import { revalidatePath } from "next/cache";
import {
  sponsorRegistrationSchema,
  sponsorLoginSchema,
  SponsorRegistrationInput,
  SponsorLoginInput,
} from "@/lib/validations/sponsor";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { hashPassword, verifyPassword } from "@/lib/security/crypto";
import {
  setSponsorSessionCookie,
  clearSponsorSessionCookie,
  getCurrentSponsorSession,
} from "@/lib/security/sponsorSession";
import {
  findSponsorByEmail,
  createSponsor,
  linkContributionsToSponsor,
  findContributionByReceipt,
  listContributionsByEmail,
  setSponsorWallPreference,
} from "@/lib/sponsorStore";
import {
  getSponsorDashboard,
  currentSponsorMeetsTier,
} from "@/lib/domain/sponsorAccess";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { SponsorDashboardDTO } from "@/types/supporter";

export interface SponsorAuthResponse {
  success: boolean;
  error?: string;
  /** Number of historical contributions attached to the new account. */
  linkedContributions?: number;
}

/**
 * Registers a sponsor account and claims their giving history.
 *
 * The receipt-number challenge is the whole point of this action: contributions are keyed
 * by donor email, so without proof that the registrant holds a receipt issued to that
 * address, anyone could register `someone-else@example.com` and inherit their standing,
 * their sponsored rescues and their Gold-tier media.
 *
 * Deliberately does not reuse `loginAction` from `@/actions/auth`, which accepts the
 * literal password "1234" for any account.
 */
export async function registerSponsorAction(
  input: SponsorRegistrationInput
): Promise<SponsorAuthResponse> {
  let parsed;
  try {
    parsed = sponsorRegistrationSchema.parse(input);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Invalid registration details.",
    };
  }

  const rateLimit = checkRateLimit(`sponsor-register:${parsed.email}`, 5, 300000);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Too many registration attempts. Please wait ${rateLimit.retryAfterSeconds}s before trying again.`,
    };
  }

  if (await findSponsorByEmail(parsed.email)) {
    return {
      success: false,
      error: "A sponsor account already exists for this email. Please sign in instead.",
    };
  }

  const contribution = await findContributionByReceipt(parsed.receiptNumber);

  // One message for "no such receipt" and "receipt belongs to someone else", so the form
  // cannot be used to enumerate which receipt numbers exist.
  if (!contribution || contribution.donorEmail !== parsed.email) {
    recordAuditLog({
      actorId: "sponsor_public",
      actorEmail: parsed.email,
      actorRole: "SPONSOR",
      action: "SPONSOR_REGISTER_FAILED",
      entity: "Sponsor",
      entityId: parsed.email,
      details: { reason: "Receipt number did not match this email address" },
    });
    return {
      success: false,
      error:
        "That receipt number does not match this email address. Check the e-Receipt we sent you when you donated.",
    };
  }

  // Sponsor Wall consent given at checkout carries into the account being claimed, so a
  // donor who ticked the box on the donation form does not have to tick it twice.
  const priorContributions = await listContributionsByEmail(parsed.email);
  const consentedAtCheckout = priorContributions.some((c) => c.displayOnWall);

  const passwordHash = await hashPassword(parsed.password);
  const sponsor = await createSponsor({
    email: parsed.email,
    name: parsed.name,
    passwordHash,
    displayOnWall: parsed.displayOnWall || consentedAtCheckout,
  });

  const linkedContributions = await linkContributionsToSponsor(sponsor.id, sponsor.email);

  await setSponsorSessionCookie({
    sponsorId: sponsor.id,
    email: sponsor.email,
    name: sponsor.name,
  });

  recordAuditLog({
    actorId: sponsor.id,
    actorEmail: sponsor.email,
    actorRole: "SPONSOR",
    action: "SPONSOR_REGISTERED",
    entity: "Sponsor",
    entityId: sponsor.id,
    details: { linkedContributions, displayOnWall: sponsor.displayOnWall },
  });

  return { success: true, linkedContributions };
}

export async function sponsorLoginAction(
  input: SponsorLoginInput
): Promise<SponsorAuthResponse> {
  let parsed;
  try {
    parsed = sponsorLoginSchema.parse(input);
  } catch {
    return { success: false, error: "Please enter your email address and password." };
  }

  const rateLimit = checkRateLimit(`sponsor-login:${parsed.email}`, 5, 60000);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Too many sign-in attempts. Please wait ${rateLimit.retryAfterSeconds}s before trying again.`,
    };
  }

  const sponsor = await findSponsorByEmail(parsed.email);
  const isValid = sponsor
    ? await verifyPassword(parsed.password, sponsor.passwordHash)
    : false;

  if (!sponsor || !isValid) {
    recordAuditLog({
      actorId: "sponsor_public",
      actorEmail: parsed.email,
      actorRole: "SPONSOR",
      action: "SPONSOR_LOGIN_FAILED",
      entity: "Sponsor",
      entityId: parsed.email,
      details: { reason: "Invalid email or password" },
    });
    return { success: false, error: "Invalid email address or password." };
  }

  await setSponsorSessionCookie({
    sponsorId: sponsor.id,
    email: sponsor.email,
    name: sponsor.name,
  });

  recordAuditLog({
    actorId: sponsor.id,
    actorEmail: sponsor.email,
    actorRole: "SPONSOR",
    action: "SPONSOR_LOGIN_SUCCESS",
    entity: "Sponsor",
    entityId: sponsor.id,
    details: {},
  });

  return { success: true };
}

export async function sponsorLogoutAction(): Promise<{ success: boolean }> {
  const session = await getCurrentSponsorSession();
  await clearSponsorSessionCookie();

  if (session) {
    recordAuditLog({
      actorId: session.sponsorId,
      actorEmail: session.email,
      actorRole: "SPONSOR",
      action: "SPONSOR_LOGOUT",
      entity: "Sponsor",
      entityId: session.sponsorId,
      details: {},
    });
  }

  return { success: true };
}

/** Toggles the signed-in sponsor's public wall opt-in. Never accepts a sponsor id. */
export async function updateWallPreferenceAction(
  displayOnWall: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentSponsorSession();
  if (!session) {
    return { success: false, error: "Please sign in to change your Sponsor Wall setting." };
  }

  await setSponsorWallPreference(session.sponsorId, displayOnWall);

  recordAuditLog({
    actorId: session.sponsorId,
    actorEmail: session.email,
    actorRole: "SPONSOR",
    action: "SPONSOR_WALL_PREFERENCE_UPDATED",
    entity: "Sponsor",
    entityId: session.sponsorId,
    details: { displayOnWall },
  });

  revalidatePath("/sponsors");
  revalidatePath("/sponsor/dashboard");

  return { success: true };
}

/** Server-side read of the signed-in sponsor's dashboard projection. */
export async function getSponsorDashboardAction(): Promise<SponsorDashboardDTO | null> {
  return getSponsorDashboard();
}

/**
 * Gold perk: a direct question to the sanctuary caretakers.
 *
 * Re-checks the standing here rather than trusting that `<TierGate requiredTier="GOLD">`
 * rendered the form. A Server Action is a public HTTP endpoint — anything that only the
 * UI stops an unauthorized caller from doing, it does not stop at all.
 */
export async function submitCaretakerQuestionAction(
  message: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentSponsorSession();
  if (!session) {
    return { success: false, error: "Please sign in to message the caretakers." };
  }

  if (!(await currentSponsorMeetsTier("GOLD"))) {
    return {
      success: false,
      error: "The caretaker Q&A is a Gold sponsorship privilege.",
    };
  }

  const trimmed = message.trim();
  if (trimmed.length < 10 || trimmed.length > 2000) {
    return {
      success: false,
      error: "Please write between 10 and 2,000 characters.",
    };
  }

  const rateLimit = checkRateLimit(`caretaker-qa:${session.sponsorId}`, 5, 3600000);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `You have reached the hourly message limit. Please try again in ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  recordAuditLog({
    actorId: session.sponsorId,
    actorEmail: session.email,
    actorRole: "SPONSOR",
    action: "CARETAKER_QUESTION_SUBMITTED",
    entity: "Sponsor",
    entityId: session.sponsorId,
    details: { messageLength: trimmed.length },
  });

  return { success: true };
}
