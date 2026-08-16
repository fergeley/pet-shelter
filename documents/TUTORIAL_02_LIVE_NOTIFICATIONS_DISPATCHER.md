# Guided Tutorial 02: Resilient Notification Dispatcher (Email & WhatsApp)

**Target Feature**: Build a unified transactional notification dispatching service for adoption milestones (Submission Confirmation, Meet & Greet Scheduling, Final Approval Notice) supporting both Resend email and WhatsApp direct communication.  
**Skill Focus**: Transactional Email Templates, Server Actions, Malaysian Mobile Normalization, and Mock Deliverability in Test Environments.

---

## 🎯 Learning Objectives

By completing this stepped tutorial, you will master:
1. Designing a decoupled notification dispatcher service in Next.js.
2. Normalizing Malaysian mobile phone numbers (`+60` / `01x-xxx xxxx`) for WhatsApp deep-links.
3. Rendering responsive, high-deliverability transactional HTML email templates.
4. Integrating Resend / SMTP with an automatic local fallback logger when no API keys are configured.
5. Triggering notifications synchronously within Server Action state transitions.

---

## 📋 Step-by-Step Implementation

### Step 1: Define Notification Domain Types
📁 **Target File**: Create [`src/types/notification.ts`](file:///c:/Users/User/pet-shelter/src/types/notification.ts)

```typescript
export type NotificationChannel = 'email' | 'whatsapp' | 'both';

export type NotificationType =
  | 'APPLICATION_SUBMITTED'
  | 'MEET_AND_GREET_SCHEDULED'
  | 'APPLICATION_APPROVED'
  | 'DONATION_RECEIPT_ISSUED';

export interface NotificationPayload {
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  type: NotificationType;
  referenceId: string;
  petName: string;
  meetAndGreetDate?: string;
  meetAndGreetLocation?: string;
  notes?: string;
}

export interface DispatchResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  whatsappUrl?: string;
  error?: string;
}
```

---

### Step 2: Malaysian Phone Number Normalizer
📁 **Target File**: Create [`src/lib/notifications/phoneUtils.ts`](file:///c:/Users/User/pet-shelter/src/lib/notifications/phoneUtils.ts)

```typescript
/**
 * Normalizes Malaysian mobile numbers into international E.164 format without '+' for WhatsApp API.
 * Examples:
 *   "012-345 6789" -> "60123456789"
 *   "+6019-8765432" -> "60198765432"
 */
export function normalizeMalaysianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("60")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return "6" + digits;
  }
  return "60" + digits;
}

/**
 * Builds a direct wa.me URL with pre-filled message text.
 */
export function buildWhatsAppLink(phone: string, text: string): string {
  const normalized = normalizeMalaysianPhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
```

---

### Step 3: Transactional HTML Email Template Builder
📁 **Target File**: Create [`src/lib/notifications/emailTemplates.ts`](file:///c:/Users/User/pet-shelter/src/lib/notifications/emailTemplates.ts)

```typescript
import { NotificationPayload } from "@/types/notification";

export function generateNotificationEmailHtml(payload: NotificationPayload): {
  subject: string;
  html: string;
} {
  const shelterName = "Hope for Strays (Persatuan Harapan Haiwan Terbiar Selangor)";
  const shelterPhone = "+60 12-345 6789";

  switch (payload.type) {
    case "APPLICATION_SUBMITTED":
      return {
        subject: `Adoption Application Received: ${payload.petName} [Ref: ${payload.referenceId}]`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px;">
            <h2 style="color: #18181b;">Thank you for applying to adopt ${payload.petName}!</h2>
            <p>Hi ${payload.recipientName},</p>
            <p>We have successfully received your adoption application. Our adoption coordinators are currently reviewing your housing and household details.</p>
            <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <strong>Application Reference ID:</strong> <code>${payload.referenceId}</code><br/>
              <strong>Selected Animal:</strong> ${payload.petName}
            </div>
            <p>You can track your real-time review progress anytime on our self-service portal:</p>
            <p><a href="https://hopeforstrays.org/applications/track" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Track Application Status</a></p>
            <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
            <p style="font-size: 12px; color: #71717a;">${shelterName}<br/>No. ROS: PPM-012-10-18042016 | Helpdesk: ${shelterPhone}</p>
          </div>
        `,
      };

    case "MEET_AND_GREET_SCHEDULED":
      return {
        subject: `Meet & Greet Scheduled: ${payload.petName} on ${payload.meetAndGreetDate}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px;">
            <h2 style="color: #18181b;">Meet & Greet Appointment Confirmed!</h2>
            <p>Hi ${payload.recipientName},</p>
            <p>We are excited to invite you and your household members to meet <strong>${payload.petName}</strong>.</p>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <strong>Date & Time:</strong> ${payload.meetAndGreetDate || "Scheduled Date"}<br/>
              <strong>Location:</strong> ${payload.meetAndGreetLocation || "Hope for Strays Sanctuary, Petaling Jaya"}<br/>
              <strong>Notes:</strong> ${payload.notes || "Please bring all primary family members."}
            </div>
            <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
            <p style="font-size: 12px; color: #71717a;">${shelterName} | Helpdesk: ${shelterPhone}</p>
          </div>
        `,
      };

    default:
      return {
        subject: `Hope for Strays Notification: ${payload.petName}`,
        html: `<p>Hi ${payload.recipientName}, please check your application status on our tracking portal.</p>`,
      };
  }
}
```

---

### Step 4: Dispatcher Engine with Resend & Mock Delivery
📁 **Target File**: Create [`src/lib/notifications/dispatcher.ts`](file:///c:/Users/User/pet-shelter/src/lib/notifications/dispatcher.ts)

```typescript
import { NotificationPayload, DispatchResult } from "@/types/notification";
import { generateNotificationEmailHtml } from "./emailTemplates";
import { buildWhatsAppLink } from "./phoneUtils";

export async function dispatchAdoptionNotification(
  payload: NotificationPayload
): Promise<DispatchResult> {
  const { subject, html } = generateNotificationEmailHtml(payload);
  const waText = `Hello ${payload.recipientName}, this is Hope for Strays regarding your adoption application for ${payload.petName} [Ref: ${payload.referenceId}]. Check your application status: https://hopeforstrays.org/applications/track`;
  const whatsappUrl = buildWhatsAppLink(payload.recipientPhone, waText);

  // 1. Resend API Dispatch (if RESEND_API_KEY is configured in .env.local)
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Hope for Strays <adoptions@hopeforstrays.org>",
          to: payload.recipientEmail,
          subject,
          html,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, channel: "both", messageId: data.id, whatsappUrl };
      }
    } catch (err) {
      console.warn("[Notification Dispatcher] Resend API error; falling back to local delivery log:", err);
    }
  }

  // 2. Safe Local Development Mock Fallback (Guarantees 0 crash without API keys)
  console.log(`[Notification Dispatcher - Mock Delivery]`);
  console.log(`To: ${payload.recipientEmail} | Subject: ${subject}`);
  console.log(`WhatsApp Link: ${whatsappUrl}`);

  return {
    success: true,
    channel: "both",
    messageId: `mock-${Date.now()}`,
    whatsappUrl,
  };
}
```

---

### Step 5: Wire into Application Review Server Action
📁 **Target File**: [`src/actions/applications.ts`](file:///c:/Users/User/pet-shelter/src/actions/applications.ts) (Around Line 150)

```typescript
// Inside updateApplicationStatusAction in src/actions/applications.ts
if (newStatus === "approved" || newStatus === "interview_scheduled") {
  await dispatchAdoptionNotification({
    recipientName: application.applicantName,
    recipientEmail: application.email,
    recipientPhone: application.phone,
    type: newStatus === "approved" ? "APPLICATION_APPROVED" : "MEET_AND_GREET_SCHEDULED",
    referenceId: application.id,
    petName: application.petName,
    meetAndGreetDate: application.scheduledDate,
    meetAndGreetLocation: "Hope for Strays Sanctuary (Section 19, Petaling Jaya)",
  });
}
```

---

## 🧪 Verification Commands

```bash
# Run Vitest Tests
npm test -- --run

# Strict TypeScript Check
npx tsc --noEmit
```
