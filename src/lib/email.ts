import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import { recordAuditLog } from "@/lib/domain/auditLog";

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

/**
 * Deliverability-Optimized Transactional Email Dispatcher.
 * Complies with Resend Best Practices:
 * 1. Uses explicit `reply_to` (No no-reply dead-ends).
 * 2. Transmits full multi-part fallback (HTML + Plain Text).
 * 3. Categorizes messages with transactional metadata tags.
 * 4. Gracefully simulates in local dev / test environments.
 * 5. Logs immutable audit entries.
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
 * Common Accessible, Lightweight HTML Wrapper (under 15KB to avoid clipping)
 */
function wrapEmailHtml(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 24px; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 28px; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .badge-approved { background: #dcfce7; color: #15803d; }
    .badge-review { background: #fef3c7; color: #b45309; }
    .badge-rejected { background: #fee2e2; color: #b91c1c; }
    .card { background: #f1f5f9; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .card-success { border-left-color: #16a34a; background: #f0fdf4; }
    .card-warning { border-left-color: #f59e0b; background: #fffbeb; }
    .steps { margin: 20px 0; padding-left: 20px; }
    .steps li { margin-bottom: 10px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
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
 * 1. Sends confirmation email to the public adopter upon submitting an adoption application.
 */
export async function sendApplicationConfirmationEmail(
  app: AdoptionApplicationRecord
): Promise<EmailResult> {
  const subject = `Application Received: Adoption Inquiry for ${app.petName} - ${SHELTER_NAME}`;
  
  const text = `
Dear ${app.applicantName},

Thank you for your interest in adopting ${app.petName} from ${SHELTER_NAME}!

We have received your application (Ref: ${app.id}). Our adoption coordinators review every submission carefully to ensure the best possible match for both animals and families.

Summary of Submission:
- Pet: ${app.petName}
- Applicant: ${app.applicantName} (${app.email} / ${app.phone})
- Housing: ${app.housingType.replace(/_/g, " ")} (Fenced yard: ${app.hasFencedYard})
- Current Pets: ${app.currentPets}

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

    <h3 style="margin-bottom: 8px;">What Happens Next?</h3>
    <ol class="steps">
      <li><strong>Review:</strong> Our coordinator team is evaluating your application (typically 1–2 business days).</li>
      <li><strong>Meet & Greet:</strong> We will contact you to arrange an interaction at our Petaling Jaya sanctuary.</li>
      <li><strong>Adoption Finalization:</strong> Finalize paperwork, receive full medical clearance records, and bring your new companion home (100% Free Adoption).</li>
    </ol>

    <p style="font-size: 14px; color: #475569;">Have questions in the meantime? Reply directly to this email or call us at <strong>${SHELTER_PHONE}</strong>.</p>
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

  const text = `
New Adoption Application Submitted
-----------------------------------
Application ID: ${app.id}
Pet: ${app.petName} (ID: ${app.petId || "N/A"})
Applicant: ${app.applicantName}
Email: ${app.email}
Phone: ${app.phone}
Address: ${app.address}
Housing: ${app.housingType} (Fenced yard: ${app.hasFencedYard})
Current Pets: ${app.currentPets}
Experience: ${app.householdExperience}
Notes: ${app.applicantNotes || "None"}

Review in Admin Dashboard:
https://hopeforstrays.org/admin/applications
  `.trim();

  const html = wrapEmailHtml(`
    <h2 style="margin-top:0; font-size: 18px; color: #0284c7;">🐾 New Adoption Application Submitted</h2>
    <p>A new adoption application has been submitted for <strong>${app.petName}</strong>.</p>
    <div class="card">
      <strong>Application Reference:</strong> ${app.id}<br/>
      <strong>Target Pet:</strong> ${app.petName}<br/>
      <strong>Applicant:</strong> ${app.applicantName}<br/>
      <strong>Email:</strong> ${app.email}<br/>
      <strong>Phone:</strong> ${app.phone}<br/>
      <strong>Address:</strong> ${app.address}<br/>
      <strong>Housing:</strong> ${app.housingType} (Fenced: ${app.hasFencedYard})<br/>
      <strong>Experience:</strong> ${app.householdExperience}<br/>
      <strong>Current Pets:</strong> ${app.currentPets}
    </div>
    <p><a href="https://hopeforstrays.org/admin/applications" style="display:inline-block;background:#0284c7;color:#ffffff;padding:10px 18px;text-decoration:none;border-radius:6px;font-weight:600;">Open Coordinator Dashboard</a></p>
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
  let subject = "";
  let badgeClass = "badge";
  let statusTitle = "";
  let messageBody = "";

  if (newStatus === "APPROVED") {
    subject = `🎉 Application Approved! Welcome to the family, ${app.applicantName} (${petName})`;
    badgeClass = "badge badge-approved";
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
      <p>If you have any questions or would like to confirm your arrival time, reply directly to this email or call us at <strong>${SHELTER_PHONE}</strong>.</p>
    `;
  } else if (newStatus === "UNDER_REVIEW") {
    subject = `Application Update: Review in Progress for ${petName} - ${SHELTER_NAME}`;
    badgeClass = "badge badge-review";
    statusTitle = `Your Application for ${petName} is Under Active Review`;
    messageBody = `
      <div class="card card-warning">
        Our adoption coordinators are currently reviewing your application details, housing profile, and compatibility requirements for <strong>${petName}</strong>.
      </div>
      <p>A team member may reach out to you via phone (<strong>${app.phone}</strong>) or email if additional verification or reference checks are required.</p>
      ${notes ? `<p><strong>Coordinator Notes:</strong><br/><em>${notes}</em></p>` : ""}
      <p>Thank you for your patience as we find loving, lifelong homes for our rescue animals.</p>
    `;
  } else if (newStatus === "REJECTED") {
    subject = `Adoption Application Status Update: ${petName} - ${SHELTER_NAME}`;
    badgeClass = "badge badge-rejected";
    statusTitle = `Application Status Update for ${petName}`;
    messageBody = `
      <p>Dear ${app.applicantName},</p>
      <p>Thank you so much for your interest in adopting <strong>${petName}</strong> and for taking the time to share your application with us.</p>
      <div class="card">
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
    <span class="badge" style="background:#e0f2fe;color:#0284c7;">Meet & Greet Scheduled</span>
    <h2 style="margin-top:0;">You're Invited to Meet ${app.petName}! 🐾</h2>
    <p>Dear ${app.applicantName},</p>
    <p>We are delighted to invite you for an interaction session with <strong>${app.petName}</strong>.</p>
    
    <div class="card" style="border-left-color:#0284c7;background:#f0f9ff;">
      <strong>Session Schedule:</strong><br/>
      📅 <strong>Date:</strong> ${details.interviewDate}<br/>
      ⏰ <strong>Time:</strong> ${details.interviewTime}<br/>
      📍 <strong>Format:</strong> ${meetingTypeLabel}<br/>
      🏠 <strong>Location:</strong> ${details.location}<br/>
      ${details.coordinatorName ? `👤 <strong>Coordinator:</strong> ${details.coordinatorName}<br/>` : ""}
    </div>

    ${details.coordinatorNotes ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;margin:16px 0;font-size:13px;">
        <strong>Coordinator Instructions:</strong><br/>
        <em>${details.coordinatorNotes}</em>
      </div>
    ` : ""}

    <h3 style="margin-bottom: 8px;">What to Bring / Prepare:</h3>
    <ul class="steps">
      <li><strong>Identification:</strong> A copy of your IC or Passport.</li>
      <li><strong>Household Members:</strong> We encourage all family / housemates to participate in the interaction.</li>
      <li><strong>Pet Socialization:</strong> If you currently have pets, let us know so our trainers can prepare a guided socialization area.</li>
    </ul>

    <p style="font-size: 14px; color: #475569;">Need to reschedule or running late? Call us at <strong>${SHELTER_PHONE}</strong> or reply to this email.</p>
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
