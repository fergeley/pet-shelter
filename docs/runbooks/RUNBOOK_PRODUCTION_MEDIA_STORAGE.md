# Runbook: Production Media & Pet Image Upload Configuration

**Hope for Strays — Animal Shelter & Adoption Platform**  
*Service Component: Media Storage Engine / Image Upload Subsystem / AWS S3 / Cloudflare R2 / Cloudinary*  
*Severity: Medium-High | Operational Guide*

---

## 1. Problem Statement & Symptoms

### Symptom
- Pet photo uploads succeed without issue during local development (`http://localhost:3000`), storing files in `/public/uploads/`.
- In production (e.g., Vercel, Netlify, AWS Amplify, Railway, Docker containers), attempting to upload photos via the Pet Management form or Settings returns:
  - `500 Internal Server Error: Failed to upload file`
  - Or console log: `EROFS: read-only file system, mkdir '/var/task/public/uploads'`
  - Or `403 Forbidden: Unauthorized: Admin access required`
  - Or uploaded images fail to load with a `404 Not Found` after deployment.

### Impact
- Shelter administrators cannot add new pet photos or update pet galleries in the production portal.
- Newly uploaded images on local disks are lost on every production redeployment or serverless instance recycle.

---

## 2. Root Cause Analysis

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Local Development                               │
│  Browser ──► POST /api/upload ──► LocalStorageProvider ──► fs.writeFile()    │
│                                                            (/public/uploads) │
│                                                            [WRITABLE DISK]   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           Production (Serverless/Vercel)                     │
│  Browser ──► POST /api/upload ──► LocalStorageProvider ──► fs.writeFile()    │
│                                                            ❌ EROFS Exception│
│                                                            [READ-ONLY DISK]  │
│                                                                              │
│  SOLUTION:                                                                   │
│  Browser ──► POST /api/upload ──► S3 / Cloudinary Provider ──► Cloud Bucket │
│                                                                (Public CDN)  │
└──────────────────────────────────────────────────────────────────────────────┘
```

1. **Read-Only Serverless Runtime Filesystem:**
   - Production hosting platforms (such as Vercel, AWS Lambda, Cloudflare Pages) mount the application directory as a **read-only filesystem**.
   - [`src/lib/storage/index.ts`](file:///c:/Users/User/pet-shelter/src/lib/storage/index.ts#L41-L47) default provider (`LocalStorageProvider`) executes `fs.mkdir` and `fs.writeFile` in `process.cwd() / "public" / "uploads"`, which throws `EROFS: read-only file system`.
2. **Next.js Static Asset Serving Constraints:**
   - Next.js serves static files from `/public` determined at **build time**. Any runtime additions to disk are not indexed by the internal static server without a server restart/rebuild.
3. **Missing Production Storage Provider Configuration:**
   - When `STORAGE_PROVIDER` is missing or undefined in production environment variables, `getStorageProvider()` defaults to `LocalStorageProvider`.
4. **Admin Authentication & Cookies on Production Domains:**
   - [`src/app/api/upload/route.ts`](file:///c:/Users/User/pet-shelter/src/app/api/upload/route.ts#L32) enforces `verifyAdminSession()`. If session secrets (`SESSION_SECRET` / `ADMIN_SECRET_KEY`) are missing, or browser cookies are blocked due to cross-domain HTTPS settings, the upload route rejects requests with `403`.
5. **Serverless Payload Size Limitations:**
   - Serverless functions impose a maximum request body limit (e.g., 4.5 MB on Vercel). Files exceeding this limit are blocked before reaching the route handler.

---

## 3. Step-by-Step Resolution Procedures

Choose one of the following cloud storage options and add the corresponding environment variables to your production hosting provider.

---

### Option A: AWS S3 (Standard Cloud Storage)

1. **Create an S3 Bucket:**
   - Bucket Name: `hope-for-strays-uploads` (or your preferred name)
   - Region: `ap-southeast-1` (or your preferred AWS region)
   - Uncheck **Block all public access** (or set up a CloudFront CDN distribution / bucket policy allowing read access to object URLs).

2. **Configure CORS on the S3 Bucket:**
   In AWS S3 Console $\rightarrow$ Permissions $\rightarrow$ Cross-origin resource sharing (CORS):
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
       "AllowedOrigins": ["https://your-production-domain.com", "http://localhost:3000"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

3. **Set Environment Variables in Production (e.g., Vercel):**
   ```env
   STORAGE_PROVIDER="s3"
   AWS_S3_BUCKET="hope-for-strays-uploads"
   AWS_REGION="ap-southeast-1"
   AWS_ACCESS_KEY_ID="AKIAxxxxxxxxxxxxxxxx"
   AWS_SECRET_ACCESS_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

   # Optional: Custom CloudFront CDN or public custom domain
   # NEXT_PUBLIC_STORAGE_URL="https://cdn.hopeforstrays.org"
   ```

---

### Option B: Cloudflare R2 (Recommended — Zero Egress Fees)

Cloudflare R2 provides an S3-compatible API without egress bandwidth costs.

1. **Create an R2 Bucket:**
   - Bucket Name: `hope-for-strays-uploads`
   - In Cloudflare Dashboard $\rightarrow$ R2 $\rightarrow$ Manage R2 API Tokens $\rightarrow$ Create Token with **Object Read & Write** permissions.

2. **Enable Public Access / Custom Domain:**
   - In bucket settings, enable **R2.dev subdomain** or connect a custom domain (e.g. `media.hopeforstrays.org`).

3. **Set Environment Variables in Production:**
   ```env
   STORAGE_PROVIDER="s3"
   AWS_S3_BUCKET="hope-for-strays-uploads"
   AWS_REGION="auto"
   AWS_ACCESS_KEY_ID="<your-r2-token-access-key-id>"
   AWS_SECRET_ACCESS_KEY="<your-r2-token-secret-access-key>"
   AWS_S3_ENDPOINT="https://<your-cloudflare-account-id>.r2.cloudflarestorage.com"
   NEXT_PUBLIC_STORAGE_URL="https://pub-<hash>.r2.dev"
   ```

---

### Option C: Cloudinary

1. **Sign up at [Cloudinary](https://cloudinary.com) & Retrieve Credentials.**
2. **Set Environment Variables in Production:**
   ```env
   STORAGE_PROVIDER="cloudinary"
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   ```

---

### Option D: Verify Production Authentication & Security Variables

Ensure the upload route can authenticate admin requests in production:

```env
# Session HMAC secret (at least 32 characters)
SESSION_SECRET="generate-a-secure-random-32-character-secret-key-here"

# Admin fallback key for direct authorization
ADMIN_SECRET_KEY="generate-a-secure-admin-secret-key-here"
```

---

## 4. Built-in Client-side Image Optimization Pipeline

To avoid hitting serverless payload limits (4.5 MB), [`src/components/admin/ImageUpload.tsx`](file:///c:/Users/User/pet-shelter/src/components/admin/ImageUpload.tsx) automatically invokes [`src/lib/imageOptimization.ts`](file:///c:/Users/User/pet-shelter/src/lib/imageOptimization.ts) before initiating uploads:

- Resizes images exceeding 1600px width/height using HTML5 Canvas.
- Re-encodes images to high-efficiency `.webp` format at 85% compression quality.
- Shrinks standard camera photos (4–12 MB) down to **~200–400 KB**, enabling fast uploads and minimal bandwidth usage.

---

## 5. Verification & Health Checks

### Test Image Upload via Admin Portal
1. Log in to the production admin portal at `/admin/login`.
2. Navigate to **Pet Management** $\rightarrow$ **Add Pet** (`/admin/pets/new`).
3. Upload a sample pet photo (JPEG, PNG, or WebP).
4. Verify that:
   - The upload progress bar reaches 100%.
   - The preview thumbnail renders properly.
   - The returned image URL points to your cloud storage bucket (e.g., `https://hope-for-strays-uploads.s3...` or `https://pub-xxxx.r2.dev/...`).
5. Save the pet record and verify the image displays on the public pet directory (`/pets`).

### Direct API Endpoint Smoke Test
```bash
curl -X POST https://your-production-domain.com/api/upload \
  -H "Cookie: admin_session=your-admin-secret-key" \
  -F "file=@test-image.jpg"
```

Expected Response:
```json
{
  "success": true,
  "url": "https://hope-for-strays-uploads.s3.ap-southeast-1.amazonaws.com/1771171300000-a1b2c3-test_image.webp",
  "filename": "1771171300000-a1b2c3-test_image.webp",
  "size": 245120,
  "provider": "s3"
}
```

---

## 6. Summary Configuration Matrix

| Provider | `STORAGE_PROVIDER` | Mandatory Keys | Best Used For |
|---|---|---|---|
| **Local Disk** | `local` (or unset) | None | Local development only (`npm run dev`) |
| **AWS S3** | `s3` | `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Enterprise AWS deployments |
| **Cloudflare R2** | `s3` | `AWS_S3_BUCKET`, `AWS_S3_ENDPOINT`, `NEXT_PUBLIC_STORAGE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | **Zero-egress cost**, fast edge CDN |
| **Cloudinary** | `cloudinary` | `CLOUDINARY_CLOUD_NAME` | Zero-setup media hosting & transformations |
