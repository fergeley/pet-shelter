import { AdoptionApplicationRecord } from "@/types/application";

export interface EmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

const SHELTER_NAME = "Hope for Strays Animal Shelter";
const SHELTER_EMAIL = process.env.SHELTER_NOTIFICATION_EMAIL || "applications@hopeforstrays.org";
const FROM_EMAIL = process.env.EMAIL_FROM || "Hope for Strays <onboarding@resend.dev>";

/**
 * Low-level resilient dispatcher using standard HTTP fetch to Resend API.
 * Gracefully falls back to structured console logging in local / CI development.
 */
async function sendRawEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipientList = Array.isArray(to) ? to : [to];

  if (!apiKey) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[Email Simulation] To: ${recipientList.join(", ")} | Subject: "${subject}"`);
    }
    return {
      success: true,
      simulated: true,
      messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Email Dispatch Error]", res.status, errText);
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown email dispatch failure";
    console.error("[Email Network Error]", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Sends confirmation email to the public adopter upon submitting an adoption application.
 */
export async function sendApplicationConfirmationEmail(
  app: AdoptionApplicationRecord
): Promise<EmailResult> {
  const subject = `Application Received: Adoption Inquiry for ${app.petName} - ${SHELTER_NAME}`;
  
  const text = `
Dear ${app.applicantName},

Thank you for your interest in adopting ${app.petName} from ${SHELTER_NAME}!

We have received your application (Ref: ${app.id}). Our adoption coordinators review every submission carefully to ensure the best possible match for both animals and families.

Next Steps:
1. Application Review: Our team reviews applications within 1-2 business days.
2. Shelter Visit / Interaction: We will contact you at ${app.phone} or ${app.email} to schedule a meet-and-greet in our Petaling Jaya facility.
3. Adoption Completion: Once approved, you will complete the adoption formalities and receive vaccination records and microchip details.

If you have any urgent questions or wish to update your application details, please reach out to us at ${SHELTER_EMAIL} or call 03-7876 5432.

Warm regards,
The Adoption Team
${SHELTER_NAME}
No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 24px; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 28px; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .card { background: #f1f5f9; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; border-radius: 0 6px 6px 0; }
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
        <li><strong>Meet & Greet:</strong> We will contact you to arrange a supervised interaction at our Petaling Jaya sanctuary.</li>
        <li><strong>Adoption Finalization:</strong> Finalize paperwork, receive full medical clearance records, and bring your new companion home.</li>
      </ol>

      <p style="font-size: 14px; color: #475569;">Have questions in the meantime? Reply directly to this email or call us at <strong>03-7876 5432</strong>.</p>
    </div>
    <div class="footer">
      ${SHELTER_NAME} &bull; No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor<br/>
      Operating Hours: Tuesday – Sunday: 10:00 AM – 5:00 PM
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendRawEmail({
    to: app.email,
    subject,
    text,
    html,
  });
}

/**
 * Sends an alert notification to shelter staff coordinators when a new application is submitted.
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

Log in to the Admin Dashboard to review:
https://hopeforstrays.org/admin/applications
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .header { background: #0284c7; color: #ffffff; padding: 18px 24px; }
    .content { padding: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
    td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    td.label { font-weight: 600; color: #475569; width: 35%; }
    .btn { display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0; font-size: 18px;">🐾 New Adoption Application Submitted</h2>
    </div>
    <div class="content">
      <p>A new adoption application has been submitted for <strong>${app.petName}</strong>.</p>
      <table>
        <tr><td class="label">App Reference</td><td><strong>${app.id}</strong></td></tr>
        <tr><td class="label">Target Pet</td><td>${app.petName} (ID: ${app.petId || "N/A"})</td></tr>
        <tr><td class="label">Applicant Name</td><td>${app.applicantName}</td></tr>
        <tr><td class="label">Email</td><td><a href="mailto:${app.email}">${app.email}</a></td></tr>
        <tr><td class="label">Phone</td><td><a href="tel:${app.phone}">${app.phone}</a></td></tr>
        <tr><td class="label">Address</td><td>${app.address}</td></tr>
        <tr><td class="label">Housing Type</td><td>${app.housingType}</td></tr>
        <tr><td class="label">Fenced Yard</td><td>${app.hasFencedYard}</td></tr>
        <tr><td class="label">Current Pets</td><td>${app.currentPets}</td></tr>
        <tr><td class="label">Experience</td><td>${app.householdExperience}</td></tr>
        <tr><td class="label">Applicant Notes</td><td>${app.applicantNotes || "—"}</td></tr>
      </table>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendRawEmail({
    to: SHELTER_EMAIL,
    subject,
    text,
    html,
  });
}
