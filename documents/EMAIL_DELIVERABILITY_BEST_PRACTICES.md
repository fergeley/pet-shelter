# Top Email Deliverability Best Practices & Setup Guide

**Hope for Strays — Animal Shelter & Adoption Platform**  
*Reference: [Resend Deliverability Best Practices](https://resend.com/blog/top-10-email-deliverability-tips)*

---

## 1. Executive Summary

Email deliverability determines whether transactional notifications (adoption confirmations, staff alerts, interview invitations) reach the adopter's **Inbox** rather than the **Spam / Junk** folder. This guide details the 10 core deliverability rules and provides the exact DNS records required for production.

---

## 2. The Top 10 Deliverability Rules

### 1. Use a Dedicated Subdomain (e.g. `mail.hopeforstrays.org`)
- **Why**: Isolates your transactional email reputation from marketing or organizational root domains.
- **Implementation**: In Resend Dashboard $\rightarrow$ Domains, add `mail.hopeforstrays.org` (or `updates.hopeforstrays.org`).

### 2. Set Up DMARC (Domain-based Message Authentication)
- **Why**: Mandatory for all senders since 2024 (enforced by Gmail, Yahoo, Apple Mail). DMARC tells receiving mail servers that emails claiming to come from your domain are genuine.
- **DNS Record to Add**:
  ```
  Type:  TXT
  Name:  _dmarc.yourdomain.com  (or _dmarc.mail.yourdomain.com)
  Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com;
  ```
  *(Once your reputation stabilizes, update `p=none` to `p=quarantine` or `p=reject` for strict spoofing protection).*

### 3. Match URLs to the Sending Domain
- **Why**: Spam filters penalize emails where links point to mismatched or obfuscated domains.
- **Implementation**: Ensure links in templates point to `https://hopeforstrays.org` or `https://mail.hopeforstrays.org`.

### 4. Avoid Link & Open Tracking for Transactional Emails
- **Why**: Open-tracking pixels and link-wrapping redirect domains trigger spam heuristics in modern corporate and ISP mail filters.
- **Implementation**: In Resend Dashboard $\rightarrow$ Domains $\rightarrow$ Settings, disable "Click Tracking" and "Open Tracking" for transactional domains.

### 5. Keep Email HTML Lightweight & Accessible (Under 102KB)
- **Why**: Gmail clips emails larger than **102 KB** with a `[Message clipped] - View entire message` warning, cutting off footer addresses and causing formatting breaks.
- **Implementation**: Our built-in templates are structured with minimal, responsive CSS (total HTML size is **< 15 KB**).
- **Multi-Part Fallback**: Always include plain text (`text`) alongside `html`.

### 6. Don't Use Look-A-Like / Suspicious Domains
- **Why**: Avoid misspellings or hyphen-heavy domains that resemble known phishing signatures.

### 7. Test Emails with Real Mailbox Providers
- **Why**: Spam filters vary between Google Workspace, Personal Gmail, iCloud, Outlook 365, and Yahoo.
- **Implementation**: Use the built-in **Live Test Email Dispatcher** in `/admin/settings` to test deliverability to various personal inboxes.

### 8. Maintain a Clean Email List & Suppress Bounces
- **Why**: Hard bounces destroy domain sender reputation.
- **Implementation**: Our application validates email formats via Zod (`z.string().email()`) before submission and suppresses automated out-of-office loops with `X-Auto-Response-Suppress`.

### 9. Don't Use `no-reply@` Addresses
- **Why**: Frustrates users and signals one-way spam. Adopters who reply to automated emails should connect directly with shelter staff.
- **Implementation**: All emails include a working `reply_to` pointing to `applications@hopeforstrays.org` (or coordinator email).

### 10. Send Consistently & Maintain Low Spam Complaint Rates
- **Why**: Maintain spam complaint rates strictly below **0.10%** (maximum 1 complaint per 1,000 emails) to stay off global blocklists.

---

## 3. Production DNS Records Checklist

When verifying your custom domain in Resend:

| Record Type | Host / Name | Value / Destination | Purpose |
| :--- | :--- | :--- | :--- |
| **MX** | `mail.yourdomain.com` | `feedback-smtp.us-east-1.amazonses.com` (or Resend MX) | Inbound & Bounce handling |
| **TXT (SPF)** | `mail.yourdomain.com` | `v=spf1 include:amazonses.com ~all` | Authorizes Resend IP addresses |
| **TXT (DKIM)** | `resend._domainkey.mail` | `k=rsa; p=MIGfMA0GCSqGSIb...` | Cryptographic signature of email |
| **TXT (DMARC)** | `_dmarc.yourdomain.com` | `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` | Authentication alignment policy |

---

## 4. In-App Testing & Monitoring

1. Log in to the Admin Dashboard: `http://localhost:3000/admin/settings`.
2. Select the **"Transactional Email (Resend)"** tab.
3. Use the **Live Email Dispatch Verification Tool** to send verification messages to different test addresses.
4. Verify delivered emails in your inbox, ensuring headers display `SPF: PASS`, `DKIM: PASS`, and `DMARC: PASS`.
