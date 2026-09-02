"use server";

import { revalidatePath } from "next/cache";
import { shelterSettingsSchema, ShelterSettingsInput } from "@/lib/validations/settings";
import { getVerifiedSession } from "@/lib/security/dal";
import { assertHasPermission, PERMISSIONS } from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { Resend } from "resend";

let serverSettings: ShelterSettingsInput = {
  shelterName: "Hope for Strays",
  email: "info@hopeforstrays.org",
  phone: "03-7876 5432",
  address: "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia",
  operatingHours: "Tuesday – Sunday: 10:00 AM – 5:00 PM",
  announcementBanner: "Weekend Adoption Drive & Free Microchip Clinic this Saturday 9 AM – 1 PM at Petaling Jaya sanctuary!",
  adoptionFeeDog: "Free",
  adoptionFeeCat: "Free",
  resendApiKey: "",
  emailFrom: "Hope for Strays <onboarding@resend.dev>",
  shelterNotificationEmail: "fergeley@gmail.com",
  storageProvider: "local",
  s3Bucket: "",
  s3Region: "ap-southeast-1",
  s3CdnUrl: "",
  cloudinaryCloudName: "",
};

/**
 * Field names whose values must never reach the audit trail.
 *
 * The SETTINGS_UPDATED entry records a full before/after of the settings
 * object, and /admin/audit renders those details to anyone holding
 * VIEW_AUDIT_LOG. Without this, saving the settings form wrote the live Resend
 * API key into the log in plaintext. Matched by suffix so a future credential
 * field is redacted by default rather than by remembering to add it here.
 */
const SECRET_FIELD_PATTERN = /(key|secret|token|password)$/i;

function redactSecrets(settings: ShelterSettingsInput): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(settings).map(([field, value]) => {
      if (!SECRET_FIELD_PATTERN.test(field)) return [field, value];
      // Preserve whether a value was set, which is the part an auditor needs,
      // without disclosing the value itself.
      return [field, typeof value === "string" && value.length > 0 ? "[redacted]" : ""];
    })
  );
}

export async function getShelterSettings(): Promise<ShelterSettingsInput> {
  return serverSettings;
}

export async function updateShelterSettings(
  data: ShelterSettingsInput
): Promise<{ success: boolean; data?: ShelterSettingsInput; error?: string }> {
  try {
    const session = await getVerifiedSession();
    assertHasPermission(session, PERMISSIONS.MANAGE_SETTINGS);

    const validated = shelterSettingsSchema.parse(data);
    const previous = { ...serverSettings };
    serverSettings = { ...validated };

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "SETTINGS_UPDATED",
      entity: "ShelterSettings",
      entityId: "global-settings",
      details: { before: redactSecrets(previous), after: redactSecrets(serverSettings) },
    });

    try {
      revalidatePath("/");
      revalidatePath("/pets");
      revalidatePath("/admin/settings");
    } catch {
      // Ignored outside Next.js runtime context (e.g. unit tests)
    }

    return { success: true, data: serverSettings };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update shelter settings";
    return { success: false, error: msg };
  }
}

export async function sendTestEmailAction(input: {
  recipientEmail: string;
  customSubject?: string;
  customMessage?: string;
}): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  try {
    const session = await getVerifiedSession();
    // Was [ADMIN, COORDINATOR] before the RBAC migration: sending a test email
    // is an operational act, not a configuration change, so it stays available
    // to the Volunteer Coordinator.
    assertHasPermission(session, PERMISSIONS.SEND_SHELTER_EMAIL);

    const recipient = input.recipientEmail.trim();
    if (!recipient || !recipient.includes("@")) {
      return { success: false, error: "Please provide a valid recipient email address." };
    }

    const apiKey = process.env.RESEND_API_KEY || serverSettings.resendApiKey;
    const fromEmail = serverSettings.emailFrom || process.env.EMAIL_FROM || "Hope for Strays <onboarding@resend.dev>";
    const subject = input.customSubject || "🐾 Hope for Strays - Live Test Email Verification";
    const bodyContent = input.customMessage || "This is a test email dispatched directly from the Hope for Strays Admin Dashboard to verify live Resend email integration.";

    if (!apiKey) {
      const simMessageId = `sim-test-${Date.now()}`;
      recordAuditLog({
        actorId: session.id,
        actorEmail: session.email,
        actorRole: session.role,
        action: "TEST_EMAIL_SENT",
        entity: "EmailService",
        entityId: simMessageId,
        details: { recipient, subject, simulated: true },
      });

      return {
        success: true,
        simulated: true,
        messageId: simMessageId,
      };
    }

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to: recipient,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">🐾 Hope for Strays Animal Shelter</h2>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <span style="display:inline-block;background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;margin-bottom:12px;">Live Integration Verified</span>
            <h3 style="margin-top:0;">Test Email Delivery Successful!</h3>
            <p>${bodyContent}</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;font-size:13px;margin:16px 0;">
              <strong>Sender:</strong> ${fromEmail}<br/>
              <strong>Recipient:</strong> ${recipient}<br/>
              <strong>Dispatched by:</strong> ${session.email} (${session.role})<br/>
              <strong>Timestamp:</strong> ${new Date().toISOString()}
            </div>
            <p style="font-size: 12px; color: #64748b;">If you received this message, your Resend API credentials and email dispatch pipeline are working 100% properly.</p>
          </div>
        </div>
      `,
    });

    if (result.error) {
      recordAuditLog({
        actorId: session.id,
        actorEmail: session.email,
        actorRole: session.role,
        action: "TEST_EMAIL_FAILED",
        entity: "EmailService",
        entityId: "test-failure",
        details: { recipient, subject, error: result.error.message },
      });

      return { success: false, error: result.error.message };
    }

    const messageId = result.data?.id;

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TEST_EMAIL_SENT",
      entity: "EmailService",
      entityId: messageId || "test-success",
      details: { recipient, subject, messageId, simulated: false },
    });

    return {
      success: true,
      simulated: false,
      messageId,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to dispatch test email";
    return { success: false, error: msg };
  }
}
