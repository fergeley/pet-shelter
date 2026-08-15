# Feature Activation Guide & Engineering Handoff

**Hope for Strays — Pet Shelter & Adoption Platform**  
*Location: No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia*  
*Last Updated: 2026-08-15*

---

## 1. Feature Overview & Architecture

This document provides complete instructions for activating, configuring, and operating the newly implemented **Cloud Storage Multi-Provider Subsystem** and **Transactional Email Lifecycle Subsystem**, as well as the handoff roadmap for the next development phase.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Next.js 16 App Router                              │
│         Public Experience (/, /pets)   │   Admin Portal (/admin/*)          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            Service Actions Layer                            │
│  src/actions/{pets, applications, auth, audit, settings}.ts                 │
└──────────────────┬───────────────────────────────────────┬──────────────────┘
                   │                                       │
┌──────────────────▼──────────────────┐ ┌──────────────────▼──────────────────┐
│        StorageProvider Engine       │ │       Transactional Mailer          │
│   src/lib/storage/index.ts          │ │   src/lib/email.ts                  │
│   - LocalStorageProvider (default)  │ │   - Resend API / Simulation Mode    │
│   - S3StorageProvider (R2/S3/MinIO) │ │   - Status Updates & Meet & Greets  │
│   - CloudinaryStorageProvider       │ │   - Immutable Audit Logging         │
│   - Client-side WebP Optimization   │ │                                     │
└─────────────────────────────────────┘ └─────────────────────────────────────┘
```

---

## 2. Activating Cloud Storage (Multi-Provider)

The application includes a pluggable `StorageProvider` abstraction (`src/lib/storage/index.ts`) that runs with zero external dependencies in local development while supporting zero-code-change cloud migrations.

### Mode 1: Local Filesystem (Default / Offline)
No configuration required. Uploads are saved to `public/uploads/` with sanitized, collision-resistant filenames (`<timestamp>-<random>-<name>`).

### Mode 2: AWS S3 / Cloudflare R2 / MinIO / Supabase Storage
Set the following environment variables in `.env.local` or your production platform (e.g., Vercel / Railway / Render):

```env
STORAGE_PROVIDER="s3"
AWS_S3_BUCKET="hope-for-strays-uploads"
AWS_REGION="ap-southeast-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."

# Optional: Cloudflare R2 or MinIO custom endpoint
# AWS_S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"

# Optional: Custom CDN domain
# NEXT_PUBLIC_STORAGE_URL="https://cdn.hopeforstrays.org"
```

### Mode 3: Cloudinary
```env
STORAGE_PROVIDER="cloudinary"
CLOUDINARY_CLOUD_NAME="your-cloud-name"
```

### Client-Side Optimization Details
- Uploads in `src/components/admin/ImageUpload.tsx` use `src/lib/imageOptimization.ts` to automatically resize oversized photos (max 1600px width/height) and encode them into `.webp` at 85% quality before network transmission.
- Reduces upload payload by 70–90% (e.g., 4.5MB raw photo $\rightarrow$ ~280KB WebP).
- Progress is tracked via `XMLHttpRequest` for authentic real-time 0–100% progress indicators.

---

## 3. Activating Transactional Emails & Meet & Greet Scheduling

### Mode 1: Development Simulation Mode (Default)
When `RESEND_API_KEY` is not present, all email dispatches run safely in simulation mode:
- Output logged to terminal: `[Email Simulation] Template: [...] | To: ... | Subject: ...`
- Audit log entry `EMAIL_SENT` is recorded with `simulated: true` and a unique message ID.
- Zero external network requests; runs offline and passes all automated tests.

### Mode 2: Live Production Dispatch (Resend)
Add your API credentials to `.env.local`:

```env
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxx"
EMAIL_FROM="Hope for Strays <onboarding@resend.dev>" # or your verified domain sender
SHELTER_NOTIFICATION_EMAIL="applications@hopeforstrays.org"
```

### Supported Email Templates & Triggers:
| Template Identifier | Recipient | Trigger / Source |
| :--- | :--- | :--- |
| `APPLICATION_CONFIRMATION` | Public Adopter | Public submission via `submitApplication()` |
| `STAFF_ALERT` | Shelter Coordinators | Public submission via `submitApplication()` |
| `STATUS_UPDATE_APPROVED` | Adopter | Coordinator approves application in `ApplicationDetailDialog` |
| `STATUS_UPDATE_UNDER_REVIEW` | Adopter | Coordinator moves to review / background check |
| `STATUS_UPDATE_REJECTED` | Adopter | Polite rejection notification with feedback remarks |
| `INTERVIEW_INVITATION` | Adopter | Coordinator schedules interaction session in dialog |

---

## 4. How to Use the Admin Workflows

### A. Uploading Rescue Animal Photos
1. Log in to `/admin/login` using `admin@hopeforstrays.org` / `admin123`.
2. Navigate to **Pets Management** (`/admin/pets`).
3. Click **"Add New Pet"** or **"Edit"** on an existing animal.
4. Drag & drop images into the primary photo or gallery dropzones.
5. Notice the instant WebP compression banner (`"Optimized: Saved X KB"`) and real-time progress bar.

### B. Scheduling a Meet & Greet / Interview
1. Navigate to **Adoption Applications** (`/admin/applications`).
2. Click **"Review"** on an application to open the detail dialog.
3. Click the **"Schedule Meet & Greet"** tab.
4. Fill in:
   - **Interaction Date** and **Time**
   - **Format** (*In-Person Shelter Visit* or *Virtual Video Interview*)
   - **Location / Video Link**
   - **Coordinator Instructions for Adopter**
5. Keep *"Send Meet & Greet invitation email"* checked and click **"Send Invitation & Schedule"**.
6. The application status updates to `UNDER_REVIEW`, the invitation email is dispatched, and the event is recorded in `/admin/audit`.

---

## 5. Handoff Summary for the Next Development Phase

### Current System Health
- **Framework**: Next.js 16.3.1 (Turbopack, App Router) & React 19.2.8
- **TypeScript**: Strict mode with zero compiler errors (`npx tsc --noEmit`)
- **Linting**: Clean (`npm run lint`)
- **Unit Tests**: **18 test suites, 146 passing tests** (`npm run test`)
- **Build**: **21/21 routes statically compiled & optimized** (`npm run build`)

---

## 6. Next Recommended Phase (Phase 3)

### Phase 3: Shelter Analytics & Performance Metrics Dashboard
*Detailed requirements available in [`tasks/06_SHELTER_ANALYTICS_AND_REPORTING.md`](file:///c:/Users/User/pet-shelter/tasks/06_SHELTER_ANALYTICS_AND_REPORTING.md).*

#### Key Deliverables:
1. **Server Actions (`src/actions/analytics.ts`)**:
   - `getShelterMetrics()`: Total rescued, active sanctuary population, adoption success rate, average length of stay (LOS), and application review velocity.
   - `getAdoptionTrends(months)`: Monthly time-series data of Intakes vs Adoptions.
   - `getSpeciesDistribution()`: Dogs vs Cats breakdown and age demographics.
2. **Dashboard UI (`src/app/admin/analytics/page.tsx`)**:
   - 4-column summary KPI cards.
   - Interactive SVG/Canvas charts (Intakes vs Adoptions, conversion funnel).
   - Preset time windows: *Last 30 Days*, *Last 90 Days*, *Year-to-Date*, *All Time*.
3. **Grant & DVS Compliance Export (`src/lib/exportReport.ts`)**:
   - Automated summary export for animal welfare grant applications and Department of Veterinary Services compliance.
4. **Unit Test Suite (`tests/unit/analytics.test.ts`)**:
   - Test metric computations, empty data fallbacks, and RBAC authorization guards.
