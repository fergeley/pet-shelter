# Task 03: Adoption Applications Board & Notifications

## Objective
Create the admin application review dashboard at `/admin/applications` and integrate automated email confirmations for adopters using Resend.

## Requirements
1. **Applications Server Actions (`src/actions/applications.ts`):**
   - `getApplications(filterStatus?: string)`: Fetches applications with associated Pet details.
   - `updateApplicationStatus(id: string, status: ApplicationStatus)`: Updates application state and revalidates paths.

2. **Admin Applications Page (`src/app/admin/applications/page.tsx`):**
   - List applications grouped by status (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`) or in a filterable table.
   - Detail view dialog showing applicant contact details, housing info, current pets, message, and pet profile link.
   - Actions to approve, reject, or move to review, with an optional notes field.

3. **Email Notification Integration (`src/lib/email.ts`):**
   - Set up `resend` client.
   - When an application is submitted:
     - Send confirmation email to applicant (*"Thank you for applying for [Pet Name]"*).
     - Send alert notification to shelter staff with application summary.
