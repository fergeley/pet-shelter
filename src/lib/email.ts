import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import { DonationReceipt } from "@/types/sponsorship";
import { recordAuditLog } from "@/lib/domain/auditLog";
import {
  DESIGN_TONES,
  DesignTone,
  EMAIL_BRAND,
  EMAIL_TONE,
  EMAIL_RECEIPT,
} from "@/lib/presentation/emailTokens";
import { getApplicationStatusPresentation } from "@/lib/presentation/applicationStatusPresentation";

export interface EmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export interface InterviewDetails {
  interviewDate: string;
  interviewTime: string;
  location: string;
  meetingType: "in_person" | "video_call";
  coordinatorNotes?: string;
  coordinatorName?: string;
}

const SHELTER_NAME = "Hope for Strays Animal Shelter";
const SHELTER_EMAIL = process.env.SHELTER_NOTIFICATION_EMAIL || "applications@hopeforstrays.org";
const FROM_EMAIL = process.env.EMAIL_FROM || "Hope for Strays <onboarding@resend.dev>";
const SHELTER_ADDRESS = "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia";
const SHELTER_PHONE = "03-7876 5432";
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://hopeforstrays.org";

function getTrackingUrl(appId: string, email: string): string {
  return `${APP_BASE_URL}/applications/track?ref=${encodeURIComponent(appId)}&email=${encodeURIComponent(email)}`;
}

/**
 * Deliverability-Optimized Transactional Email Dispatcher.
 */
async function sendRawEmail({
  to,
  subject,
  html,
  text,
  template,
  entityId,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  template: string;
  entityId?: string;
  replyTo?: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipientList = Array.isArray(to) ? to : [to];
  const primaryRecipient = recipientList[0] || "unknown";
  const effectiveReplyTo = replyTo || SHELTER_EMAIL;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[Email Simulation] Template: [${template}] | To: ${recipientList.join(", ")} | Subject: "${subject}"`);
    }

    const messageId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    recordAuditLog({
      actorId: "system_mailer",
      actorEmail: "mailer@hopeforstrays.org",
      actorRole: "SYSTEM",
      action: "EMAIL_SENT",
      entity: "AdoptionApplication",
      entityId: entityId || "system",
      details: {
        template,
        recipient: primaryRecipient,
        subject,
        messageId,
        simulated: true,
      },
    });

    return {
      success: true,
      simulated: true,
      messageId,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipientList,
        reply_to: effectiveReplyTo,
        subject,
        html,
        text,
        headers: {
          "X-Entity-Ref-ID": entityId || "system",
          "X-Auto-Response-Suppress": "OOF, AutoReply",
        },
        tags: [
          { name: "category", value: "transactional" },
          { name: "template", value: template.toLowerCase() },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Email Dispatch Error]", res.status, errText);

      recordAuditLog({
        actorId: "system_mailer",
        actorEmail: "mailer@hopeforstrays.org",
        actorRole: "SYSTEM",
        action: "EMAIL_FAILED",
        entity: "AdoptionApplication",
        entityId: entityId || "system",
        details: {
          template,
          recipient: primaryRecipient,
          subject,
          error: `HTTP ${res.status}: ${errText}`,
        },
      });

      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();

    recordAuditLog({
      actorId: "system_mailer",
      actorEmail: "mailer@hopeforstrays.org",
      actorRole: "SYSTEM",
      action: "EMAIL_SENT",
      entity: "AdoptionApplication",
      entityId: entityId || "system",
      details: {
        template,
        recipient: primaryRecipient,
        subject,
        messageId: data.id,
        simulated: false,
      },
    });

    return { success: true, messageId: data.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown email dispatch failure";
    console.error("[Email Network Error]", errorMsg);

    recordAuditLog({
      actorId: "system_mailer",
      actorEmail: "mailer@hopeforstrays.org",
      actorRole: "SYSTEM",
      action: "EMAIL_FAILED",
      entity: "AdoptionApplication",
      entityId: entityId || "system",
      details: {
        template,
        recipient: primaryRecipient,
        subject,
        error: errorMsg,
      },
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * One badge rule and one card rule per tone, generated from the hex mirror.
 *
 * Generated rather than hand-written, because the property that matters is *completeness*.
 * The email previously carried four badge classes named after application statuses
 * (`badge-approved`, `badge-review`, …) while the app has seven tones, so `care`, `neutral`
 * and `highlight` had no email representation at all: a notification about an animal under
 * veterinary care fell back to the default sky badge — the colour the app reserves for
 * "informational". A loop means a new tone reaches the inbox in the colour it has on screen
 * without anyone remembering to come back here and add a rule.
 *
 * The class name is the tone name, so `designToneFor` below can compose it from the tone the
 * app already publishes rather than from a second status → colour table.
 */
const TONE_RULES = DESIGN_TONES.map(
  (tone) =>
    `    .badge-${tone} { background: ${EMAIL_TONE[tone].surface}; color: ${EMAIL_TONE[tone].text}; }\n` +
    `    .card-${tone} { background: ${EMAIL_TONE[tone].surface}; border-left-color: ${EMAIL_TONE[tone].accent}; }`
).join("\n");

/**
 * The design-system tone an application status is shown in — the same one the app uses.
 *
 * Read out of `applicationStatusPresentation`, which already owns status → tone for every
 * admin surface, instead of being restated here. A second copy is the defect this whole
 * change exists to remove: an approved application was emerald in the admin table and
 * green-700 in the inbox, and nothing detected the two drifting apart.
 *
 * `toneClass` is `tone-<tone>` by the design system's own definition — `globals.css` declares
 * exactly one `.tone-*` selector per tone, and `designSystemGuards` enforces it — so the tone
 * name is recoverable from it. The fallback mirrors the presentation module's own (an
 * unrecognised status is informational): a status email is not worth failing a dispatch over,
 * and the guard asserts that no real status reaches it.
 */
function designToneFor(status: ApplicationStatus): DesignTone {
  const tone = getApplicationStatusPresentation(status).toneClass.replace(/^tone-/, "");
  return (DESIGN_TONES as readonly string[]).includes(tone) ? (tone as DesignTone) : "info";
}

/**
 * Common Accessible, Lightweight HTML Wrapper (under 15KB)
 */
function wrapEmailHtml(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: ${EMAIL_BRAND.foreground}; margin: 0; padding: 24px; background-color: ${EMAIL_BRAND.background}; }
    .container { max-width: 600px; margin: 0 auto; background: ${EMAIL_BRAND.card}; border: 1px solid ${EMAIL_BRAND.border}; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: ${EMAIL_BRAND.primary}; color: ${EMAIL_BRAND.primaryForeground}; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 28px; }
    .badge { display: inline-block; background: ${EMAIL_TONE.info.surface}; color: ${EMAIL_TONE.info.text}; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .card { background: ${EMAIL_BRAND.muted}; border-left: 4px solid ${EMAIL_TONE.info.accent}; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0; }
${TONE_RULES}
    .steps { margin: 20px 0; padding-left: 20px; }
    .steps li { margin-bottom: 10px; }
    .btn-track { display: inline-block; background: ${EMAIL_BRAND.primary}; color: ${EMAIL_BRAND.primaryForeground} !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; margin: 16px 0; text-align: center; }
    .footer { background: ${EMAIL_BRAND.muted}; padding: 20px; text-align: center; font-size: 12px; color: ${EMAIL_BRAND.mutedForeground}; border-top: 1px solid ${EMAIL_BRAND.border}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${SHELTER_NAME}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      ${SHELTER_NAME} &bull; ${SHELTER_ADDRESS}<br/>
      Phone: ${SHELTER_PHONE} &bull; Hours: Tuesday – Sunday: 10:00 AM – 5:00 PM
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Escapes free text before it is interpolated into an HTML email body. Donor- and applicant-typed
 * fields arrive here straight from a public form, so they cannot be trusted as markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 1. Sends confirmation email to the public adopter upon submitting an adoption application.
 */
export async function sendApplicationConfirmationEmail(
  app: AdoptionApplicationRecord
): Promise<EmailResult> {
  const subject = `Application Received: Adoption Inquiry for ${app.petName} - ${SHELTER_NAME}`;
  const trackingUrl = getTrackingUrl(app.id, app.email);

  const text = `
Dear ${app.applicantName},

Thank you for your interest in adopting ${app.petName} from ${SHELTER_NAME}!

We have received your application (Ref: ${app.id}). Our adoption coordinators review every submission carefully to ensure the best possible match for both animals and families.

Summary of Submission:
- Pet: ${app.petName}
- Applicant: ${app.applicantName} (${app.email} / ${app.phone})
- Housing: ${app.housingType.replace(/_/g, " ")} (Fenced yard: ${app.hasFencedYard})
- Current Pets: ${app.currentPets}

Track Your Application Live:
${trackingUrl}

Next Steps:
1. Application Review: Our team reviews applications within 1-2 business days.
2. Shelter Visit / Interaction: We will contact you at ${app.phone} or ${app.email} to schedule a meet-and-greet in our Petaling Jaya facility.
3. Adoption Completion: Once approved, you will complete the 100% free adoption formalities and receive vaccination records and microchip details.

If you have questions, please reach out to us by replying to this email or calling ${SHELTER_PHONE}.

Warm regards,
The Adoption Team
${SHELTER_NAME}
${SHELTER_ADDRESS}
  `.trim();

  const html = wrapEmailHtml(`
    <span class="badge">Application Ref: ${app.id}</span>
    <h2 style="margin-top:0;">Thank you, ${app.applicantName}!</h2>
    <p>We have successfully received your adoption application for <strong>${app.petName}</strong>.</p>
    
    <div class="card">
      <strong>Summary of Submission:</strong><br/>
      Pet: ${app.petName}<br/>
      Applicant: ${app.applicantName} (${app.email} / ${app.phone})<br/>
      Housing: ${app.housingType.replace(/_/g, " ")} (Fenced yard: ${app.hasFencedYard})<br/>
      Current Pets: ${app.currentPets}
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${trackingUrl}" class="btn-track">🔍 Track Your Application Live &rarr;</a>
    </div>

    <h3 style="margin-bottom: 8px;">What Happens Next?</h3>
    <ol class="steps">
      <li><strong>Review:</strong> Our coordinator team is evaluating your application (typically 1–2 business days).</li>
      <li><strong>Meet & Greet:</strong> We will contact you to arrange an interaction at our Petaling Jaya sanctuary.</li>
      <li><strong>Adoption Finalization:</strong> Finalize paperwork, receive full medical clearance records, and bring your new companion home (100% Free Adoption).</li>
    </ol>

    <p style="font-size: 14px; color: ${EMAIL_BRAND.mutedForeground};">Have questions in the meantime? Reply directly to this email or call us at <strong>${SHELTER_PHONE}</strong>.</p>
  `);

  return sendRawEmail({
    to: app.email,
    subject,
    text,
    html,
    template: "APPLICATION_CONFIRMATION",
    entityId: app.id,
  });
}

/**
 * 2. Sends an alert notification to shelter staff coordinators when a new application is submitted.
 */
export async function sendStaffApplicationAlert(
  app: AdoptionApplicationRecord
): Promise<EmailResult> {
  const subject = `[New Application] ${app.applicantName} applied for ${app.petName} (${app.id})`;

  // The only two values in this alert that are resolved rather than passed straight through. Both
  // halves below read them from here; neither re-derives a fallback of its own. Writing `|| "None"`
  // twice by hand is precisely how the HTML half came to omit the applicant's own notes while the
  // plain text carried them — see docs/tasks/URGENT_RECEIPT_EMAIL_CORRECTNESS.md. The HTML escapes
  // at the point of use: `notes` is free text straight off a public form.
  const fields = {
    petId: app.petId || "N/A",
    notes: app.applicantNotes || "None",
  };

  const text = `
New Adoption Application Submitted
-----------------------------------
Application ID: ${app.id}
Pet: ${app.petName} (ID: ${fields.petId})
Applicant: ${app.applicantName}
Email: ${app.email}
Phone: ${app.phone}
Address: ${app.address}
Housing: ${app.housingType} (Fenced yard: ${app.hasFencedYard})
Current Pets: ${app.currentPets}
Experience: ${app.householdExperience}
Notes: ${fields.notes}

Review in Admin Dashboard:
https://hopeforstrays.org/admin/applications
  `.trim();

  const html = wrapEmailHtml(`
    <h2 style="margin-top:0; font-size: 18px; color: ${EMAIL_BRAND.primary};">🐾 New Adoption Application Submitted</h2>
    <p>A new adoption application has been submitted for <strong>${app.petName}</strong>.</p>
    <div class="card">
      <strong>Application Reference:</strong> ${app.id}<br/>
      <strong>Target Pet:</strong> ${app.petName} (ID: ${escapeHtml(fields.petId)})<br/>
      <strong>Applicant:</strong> ${app.applicantName}<br/>
      <strong>Email:</strong> ${app.email}<br/>
      <strong>Phone:</strong> ${app.phone}<br/>
      <strong>Address:</strong> ${app.address}<br/>
      <strong>Housing:</strong> ${app.housingType} (Fenced: ${app.hasFencedYard})<br/>
      <strong>Experience:</strong> ${app.householdExperience}<br/>
      <strong>Current Pets:</strong> ${app.currentPets}<br/>
      <strong>Notes:</strong> ${escapeHtml(fields.notes)}
    </div>
    <p><a href="https://hopeforstrays.org/admin/applications" style="display:inline-block;background:${EMAIL_BRAND.primary};color:${EMAIL_BRAND.primaryForeground};padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600;">Open Coordinator Dashboard</a></p>
  `);

  return sendRawEmail({
    to: SHELTER_EMAIL,
    replyTo: app.email,
    subject,
    text,
    html,
    template: "STAFF_ALERT",
    entityId: app.id,
  });
}

/**
 * 3. Sends status update email to the applicant (Approved, Under Review, or Rejected).
 */
export async function sendApplicationStatusUpdateEmail(
  app: AdoptionApplicationRecord,
  newStatus: ApplicationStatus,
  notes?: string
): Promise<EmailResult> {
  const petName = app.petName;
  const trackingUrl = getTrackingUrl(app.id, app.email);
  let subject = "";
  let statusTitle = "";
  let messageBody = "";

  // The status badge is coloured by the app's own status → tone mapping, so the inbox cannot
  // disagree with the admin table about what an approved application looks like. Every tone
  // has a badge rule, so this cannot fall back to the informational sky it used to.
  const badgeClass = `badge badge-${designToneFor(newStatus)}`;

  if (newStatus === "APPROVED") {
    subject = `🎉 Application Approved! Welcome to the family, ${app.applicantName} (${petName})`;
    statusTitle = `Great News! Your Application for ${petName} is Approved!`;
    messageBody = `
      <div class="card card-success">
        <strong>Congratulations ${app.applicantName}!</strong><br/>
        Our adoption coordinator team has reviewed and approved your adoption application for <strong>${petName}</strong>!
      </div>
      <h3 style="margin-bottom: 8px;">Next Steps to Welcome ${petName} Home:</h3>
      <ol class="steps">
        <li><strong>Adoption Appointment:</strong> Visit our shelter at ${SHELTER_ADDRESS} to meet ${petName} and sign the adoption charter.</li>
        <li><strong>Medical Dossier:</strong> We will provide full vaccination passports, deworming history, and microchip registration certificates (100% Free of charge).</li>
        <li><strong>Starter Essentials:</strong> Bring a secure pet carrier (for cats) or leash/collar (for dogs) on adoption day.</li>
      </ol>
      ${notes ? `<p><strong>Coordinator Remarks:</strong><br/><em>${notes}</em></p>` : ""}
      <div style="text-align:center;margin:20px 0;">
        <a href="${trackingUrl}" class="btn-track">🔍 View Official Adoption Dossier &rarr;</a>
      </div>
      <p>If you have any questions or would like to confirm your arrival time, reply directly to this email or call us at <strong>${SHELTER_PHONE}</strong>.</p>
    `;
  } else if (newStatus === "UNDER_REVIEW") {
    subject = `Application Update: Review in Progress for ${petName} - ${SHELTER_NAME}`;
    statusTitle = `Your Application for ${petName} is Under Active Review`;
    messageBody = `
      <div class="card card-warning">
        Our adoption coordinators are currently reviewing your application details, housing profile, and compatibility requirements for <strong>${petName}</strong>.
      </div>
      <p>A team member may reach out to you via phone (<strong>${app.phone}</strong>) or email if additional verification or reference checks are required.</p>
      ${notes ? `<p><strong>Coordinator Notes:</strong><br/><em>${notes}</em></p>` : ""}
      <div style="text-align:center;margin:20px 0;">
        <a href="${trackingUrl}" class="btn-track">🔍 Track Application Progress &rarr;</a>
      </div>
      <p>Thank you for your patience as we find loving, lifelong homes for our rescue animals.</p>
    `;
  } else if (newStatus === "REJECTED") {
    subject = `Adoption Application Status Update: ${petName} - ${SHELTER_NAME}`;
    statusTitle = `Application Status Update for ${petName}`;
    messageBody = `
      <p>Dear ${app.applicantName},</p>
      <p>Thank you so much for your interest in adopting <strong>${petName}</strong> and for taking the time to share your application with us.</p>
      <div class="card">
        <!-- Neutral on purpose: the badge carries the danger tone, but a rejection letter
             does not need a red panel shouting at the applicant as well. -->
        After careful evaluation of ${petName}'s specific behavioral needs and current shelter applications, we regret to inform you that we are unable to proceed with this adoption match at this time.
      </div>
      ${notes ? `<p><strong>Shelter Feedback:</strong><br/><em>${notes}</em></p>` : ""}
      <p>We receive multiple inquiries for our rescues, and our decisions are made solely with the animal's specific temperament and long-term wellbeing in mind. We warmly encourage you to check back for other wonderful animals who may be an ideal match for your home.</p>
    `;
  } else {
    subject = `Application Status Update: ${petName} (${newStatus})`;
    statusTitle = `Application Status: ${newStatus}`;
    messageBody = `<p>Your application status has been updated to <strong>${newStatus}</strong>.</p>`;
  }

  const plainText = `
Dear ${app.applicantName},

Status Update for ${petName} (Application Ref: ${app.id}):
Status: ${newStatus}

Track Application Online:
${trackingUrl}

${notes ? `Coordinator Notes:\n${notes}\n` : ""}

Shelter Contact:
${SHELTER_NAME}
${SHELTER_ADDRESS}
Phone: ${SHELTER_PHONE}
  `.trim();

  const html = wrapEmailHtml(`
    <span class="${badgeClass}">Status: ${newStatus.replace(/_/g, " ")}</span>
    <h2 style="margin-top:0;">${statusTitle}</h2>
    ${messageBody}
  `);

  return sendRawEmail({
    to: app.email,
    subject,
    text: plainText,
    html,
    template: `STATUS_UPDATE_${newStatus}`,
    entityId: app.id,
  });
}

/**
 * 4. Sends Meet & Greet / Interview scheduling invitation to the applicant.
 */
export async function sendInterviewInvitationEmail(
  app: AdoptionApplicationRecord,
  details: InterviewDetails
): Promise<EmailResult> {
  const subject = `📅 Meet & Greet Invitation for ${app.petName} - ${SHELTER_NAME}`;
  const meetingTypeLabel = details.meetingType === "video_call" ? "Virtual Video Call" : "In-Person Shelter Visit";
  const trackingUrl = getTrackingUrl(app.id, app.email);

  const plainText = `
Dear ${app.applicantName},

Great news! We would love to invite you for a Meet & Greet session with ${app.petName}!

Session Details:
- Date: ${details.interviewDate}
- Time: ${details.interviewTime}
- Format: ${meetingTypeLabel}
- Location / Link: ${details.location}
${details.coordinatorName ? `- Coordinator: ${details.coordinatorName}` : ""}
${details.coordinatorNotes ? `\nSpecial Instructions:\n${details.coordinatorNotes}` : ""}

Track & View Appointment Online:
${trackingUrl}

What to Bring / Prepare:
1. Identification (IC / Passport copy).
2. All household members who will be living with ${app.petName} are encouraged to attend.
3. If you have existing dogs, let us know in advance so we can prepare a safe temperament introduction.

If you need to reschedule or have questions, please call us at ${SHELTER_PHONE} or reply to this email.

Warm regards,
The Adoption Team
${SHELTER_NAME}
  `.trim();

  const html = wrapEmailHtml(`
    <span class="badge badge-info">Meet &amp; Greet Scheduled</span>
    <h2 style="margin-top:0;">You're Invited to Meet ${app.petName}! 🐾</h2>
    <p>Dear ${app.applicantName},</p>
    <p>We are delighted to invite you for an interaction session with <strong>${app.petName}</strong>.</p>
    
    <div class="card card-info">
      <strong>Session Schedule:</strong><br/>
      📅 <strong>Date:</strong> ${details.interviewDate}<br/>
      ⏰ <strong>Time:</strong> ${details.interviewTime}<br/>
      📍 <strong>Format:</strong> ${meetingTypeLabel}<br/>
      🏠 <strong>Location:</strong> ${details.location}<br/>
      ${details.coordinatorName ? `👤 <strong>Coordinator:</strong> ${details.coordinatorName}<br/>` : ""}
    </div>

    ${details.coordinatorNotes ? `
      <div style="background:${EMAIL_BRAND.muted};border:1px solid ${EMAIL_BRAND.border};padding:12px;border-radius:6px;margin:16px 0;font-size:13px;">
        <strong>Coordinator Instructions:</strong><br/>
        <em>${details.coordinatorNotes}</em>
      </div>
    ` : ""}

    <div style="text-align:center;margin:20px 0;">
      <a href="${trackingUrl}" class="btn-track">📅 View Appointment & Location on Maps &rarr;</a>
    </div>

    <h3 style="margin-bottom: 8px;">What to Bring / Prepare:</h3>
    <ul class="steps">
      <li><strong>Identification:</strong> A copy of your IC or Passport.</li>
      <li><strong>Household Members:</strong> We encourage all family / housemates to participate in the interaction.</li>
      <li><strong>Pet Socialization:</strong> If you currently have pets, let us know so our trainers can prepare a guided socialization area.</li>
    </ul>

    <p style="font-size: 14px; color: ${EMAIL_BRAND.mutedForeground};">Need to reschedule or running late? Call us at <strong>${SHELTER_PHONE}</strong> or reply to this email.</p>
  `);

  return sendRawEmail({
    to: app.email,
    subject,
    text: plainText,
    html,
    template: "INTERVIEW_INVITATION",
    entityId: app.id,
  });
}

/** The payment rails a donation can arrive on, read off the receipt that renders them. */
type PaymentMethod = DonationReceipt["paymentMethod"];

/**
 * Payment-rail labels for the statutory Sec 44(6) receipt.
 *
 * Exhaustive by construction. Keyed off `DonationReceipt["paymentMethod"]` — the exact union the
 * templates below render — so a fourth rail added to that type fails the build here rather than
 * silently receipting the donation as something it was not. A card donation was previously
 * receipted as a bank transfer in the HTML half; see
 * docs/tasks/URGENT_RECEIPT_EMAIL_CORRECTNESS.md.
 *
 * `online_banking` deliberately does not name a bank: the receipt carries no bank field, so the
 * old "(Maybank)" in the plain-text half was an unverifiable claim on a tax document.
 */
const PAYMENT_RAIL_LABELS: Record<PaymentMethod, string> = {
  duitnow_qr: "DuitNow QR (PayNet)",
  online_banking: "Direct Bank Transfer",
  card: "Credit / Debit Card",
};

/**
 * 5. Sends official Malaysian tax-deductible e-Receipt for rescue donations and pet sponsorships.
 */
export async function sendDonationReceiptEmail(
  receipt: DonationReceipt
): Promise<EmailResult> {
  // Single source of truth for every value both halves of this receipt state. The plain-text and
  // HTML bodies below read from here and never re-derive a value of their own — one field resolved
  // twice, by hand, in two languages is exactly what let the two halves disagree about how the
  // donor paid.
  const fields = {
    frequencyLabel:
      receipt.frequency === "monthly" ? "Monthly Recurring Partner" : "One-Time Contribution",
    amount: `RM ${receipt.amountMYR.toFixed(2)}`,
    paymentRail: PAYMENT_RAIL_LABELS[receipt.paymentMethod],
    donorPhone: receipt.donorPhone ?? "",
    taxIdOrIc: receipt.taxIdOrIc ?? "",
    targetPetName: receipt.targetPetName ?? "",
    notes: receipt.notes ?? "",
  };

  const subject = `🐾 Official Donation Receipt: ${fields.amount} - ${receipt.receiptNumber} (${SHELTER_NAME})`;

  const plainText = `
OFFICIAL DONATION RECEIPT & TAX DEDUCTION DOSSIER
===================================================
${SHELTER_NAME}
${SHELTER_ADDRESS}
Phone: ${SHELTER_PHONE} | Email: ${SHELTER_EMAIL}
Registrar of Societies (PPM): ${receipt.shelterRegistrationNo}
LHDN Tax Exemption Reference: ${receipt.taxDeductibleRef}

Receipt No: ${receipt.receiptNumber}
Date Issued: ${receipt.date}
Contribution Frequency: ${fields.frequencyLabel}

DONOR INFORMATION:
- Issued To: ${receipt.donorName}
- Email: ${receipt.donorEmail}
${fields.donorPhone ? `- Phone: ${fields.donorPhone}\n` : ""}${fields.taxIdOrIc ? `- NRIC / Passport / SSM: ${fields.taxIdOrIc}\n` : ""}
SPONSORSHIP ALLOCATION:
- Allocation: ${receipt.tierName}
${fields.targetPetName ? `- Dedicated Animal: ${fields.targetPetName}\n` : ""}- Payment Rail: ${fields.paymentRail}
${fields.notes ? `- Donor Message: "${fields.notes}"\n` : ""}
TOTAL CONTRIBUTION RECEIVED: ${fields.amount}

* Under Subsection 44(6) of the Income Tax Act 1967 (Malaysia), donations to Pertubuhan Kebajikan Hope for Strays are eligible for income tax deductions.
* This receipt is computer-generated and valid without signature.

Thank you for your life-saving generosity and support of our shelter animals!
  `.trim();

  const html = wrapEmailHtml(`
    <div style="border-bottom: 2px solid ${EMAIL_RECEIPT.ink}; padding-bottom: 16px; margin-bottom: 20px;">
      <span class="badge badge-success">Official Tax-Exempt e-Receipt</span>
      <h2 style="margin: 8px 0 4px 0; font-size: 22px; color: ${EMAIL_RECEIPT.ink};">Thank You for Your Generous Contribution!</h2>
      <p style="margin: 0; font-size: 13px; color: ${EMAIL_RECEIPT.inkMuted};">
        Receipt Reference: <strong style="font-family: monospace; color: ${EMAIL_RECEIPT.ink};">${receipt.receiptNumber}</strong> &bull; Date: ${receipt.date}
      </p>
    </div>

    <p>Dear <strong>${receipt.donorName}</strong>,</p>
    <p>We gratefully acknowledge receipt of your gift of <strong style="font-size: 16px; color: ${EMAIL_RECEIPT.ink};">${fields.amount}</strong> (${fields.frequencyLabel}) to <strong>${SHELTER_NAME}</strong>.</p>

    <div class="card" style="background:${EMAIL_RECEIPT.paper}; border-left: 4px solid ${EMAIL_RECEIPT.inkAccent}; padding: 18px; margin: 20px 0;">
      <table style="width:100%; font-size: 13px; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.inkFaint}; width: 40%;"><strong>Issued To:</strong></td>
          <td style="padding: 4px 0; font-weight: 600; color: ${EMAIL_RECEIPT.ink};">${receipt.donorName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.inkFaint};"><strong>Email / Contact:</strong></td>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.ink};">${receipt.donorEmail} ${fields.donorPhone ? `(${fields.donorPhone})` : ""}</td>
        </tr>
        ${fields.taxIdOrIc ? `
        <tr>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.inkFaint};"><strong>Tax ID / NRIC / SSM:</strong></td>
          <td style="padding: 4px 0; font-family: monospace; font-weight: 600; color: ${EMAIL_RECEIPT.ink};">${fields.taxIdOrIc}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.inkFaint};"><strong>Allocation Fund:</strong></td>
          <td style="padding: 4px 0; font-weight: 600; color: ${EMAIL_RECEIPT.ink};">${receipt.tierName}</td>
        </tr>
        ${fields.targetPetName ? `
        <tr>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.inkFaint};"><strong>Dedicated Pet:</strong></td>
          <td style="padding: 4px 0; font-weight: 600; color: ${EMAIL_RECEIPT.inkSoft};">🐾 ${fields.targetPetName}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.inkFaint};"><strong>Payment Rail:</strong></td>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.ink};">${fields.paymentRail}</td>
        </tr>
        ${fields.notes ? `
        <tr>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.inkFaint};"><strong>Donor Message:</strong></td>
          <td style="padding: 4px 0; color: ${EMAIL_RECEIPT.ink}; font-style: italic;">&quot;${escapeHtml(fields.notes)}&quot;</td>
        </tr>` : ""}
        <tr style="border-top: 1px solid ${EMAIL_RECEIPT.rule};">
          <td style="padding: 10px 0 4px 0; font-size: 15px; font-weight: 700; color: ${EMAIL_RECEIPT.ink};"><strong>Total Received:</strong></td>
          <td style="padding: 10px 0 4px 0; font-size: 18px; font-weight: 800; color: ${EMAIL_RECEIPT.inkAccent};">${fields.amount}</td>
        </tr>
      </table>
    </div>

    <div style="background:${EMAIL_RECEIPT.panel}; padding: 14px; border-radius: 6px; font-size: 12px; color: ${EMAIL_RECEIPT.inkSoft}; margin: 20px 0; line-height: 1.5; border: 1px solid ${EMAIL_RECEIPT.rule};">
      <strong>Malaysian Tax Deduction Information:</strong><br/>
      Official Shelter Registration No: <strong>${receipt.shelterRegistrationNo}</strong><br/>
      LHDN Inland Revenue Board Tax Exemption Reference: <strong>${receipt.taxDeductibleRef}</strong><br/>
      <em>* This computer-generated receipt is valid for personal or corporate tax filing in Malaysia under Section 44(6) of the Income Tax Act 1967.</em>
    </div>

    <p style="font-size: 14px; color: ${EMAIL_BRAND.mutedForeground};">
      Because of donors like you, 100% of our rescued dogs and cats receive full veterinary clearance, spay/neuter surgery, and free adoption placements.
    </p>

    <p style="font-size: 13px; color: ${EMAIL_BRAND.mutedForeground}; margin-top: 24px;">
      Warm regards,<br/>
      <strong>The Hope for Strays Sanctuary & Caretaker Team</strong><br/>
      ${SHELTER_ADDRESS}
    </p>
  `);

  return sendRawEmail({
    to: receipt.donorEmail,
    subject,
    text: plainText,
    html,
    template: "DONATION_RECEIPT",
    entityId: receipt.receiptNumber,
  });
}

/**
 * 6. Delivers a Gold sponsor's question to the sanctuary care team.
 *
 * Addressed to the shelter with `replyTo` set to the sponsor, so a caretaker answers by
 * replying — the same shape as `sendStaffApplicationAlert`, and the reason this perk needs
 * no inbox UI of its own.
 */
export async function sendCaretakerQuestionEmail(question: {
  sponsorName: string;
  sponsorEmail: string;
  tier: string;
  message: string;
}): Promise<EmailResult> {
  const subject = `[${question.tier} Sponsor Q&A] Question from ${question.sponsorName}`;

  const text = `
Caretaker Question from a Sponsor
-----------------------------------
Sponsor: ${question.sponsorName}
Email: ${question.sponsorEmail}
Sponsorship standing: ${question.tier}

Message:
${question.message}

Reply directly to this email to answer the sponsor.
  `.trim();

  const html = wrapEmailHtml(`
    <div style="border-bottom: 2px solid ${EMAIL_BRAND.foreground}; padding-bottom: 16px; margin-bottom: 20px;">
      <span class="badge" style="background:${EMAIL_TONE.warning.surface};color:${EMAIL_TONE.warning.text};">${escapeHtml(question.tier)} Sponsor Privilege</span>
      <h2 style="margin: 8px 0 4px 0; font-size: 22px; color: ${EMAIL_BRAND.foreground};">Question for the Care Team</h2>
    </div>

    <p><strong>${escapeHtml(question.sponsorName)}</strong> (${escapeHtml(question.sponsorEmail)}) asked:</p>

    <div class="card" style="background:${EMAIL_BRAND.muted}; border-left: 4px solid ${EMAIL_BRAND.primary}; padding: 18px; margin: 20px 0; white-space: pre-wrap;">${escapeHtml(question.message)}</div>

    <p style="font-size: 13px; color: ${EMAIL_BRAND.mutedForeground};">
      Reply directly to this email to answer the sponsor. Gold sponsors are told to expect a
      response within three working days.
    </p>
  `);

  return sendRawEmail({
    to: SHELTER_EMAIL,
    replyTo: question.sponsorEmail,
    subject,
    text,
    html,
    template: "CARETAKER_QUESTION",
  });
}

