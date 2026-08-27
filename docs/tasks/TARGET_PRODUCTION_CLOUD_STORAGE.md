# Target — Production Cloud Object Storage (S3 / Cloudflare R2 / Supabase)

**Date**: 2026-08-27  
**Branch**: eat/tnrm-rehabilitation  
**Baseline**: 41 unit test files / 524 tests green · 
px tsc --noEmit clean  
**Related Specs**:
- [Runbook: Production Media Storage](../runbooks/RUNBOOK_PRODUCTION_MEDIA_STORAGE.md)
- [Architecture Blueprint](../architecture/ARCHITECTURE_BLUEPRINT.md)

---

## 1. 🎯 Objective & Problem Context

The application currently defaults to LocalStorageProvider, writing uploaded pet photos and medical records directly to public/uploads/ on the local filesystem. In production serverless environments (e.g. Vercel, Neon, Docker containers), local filesystem storage is ephemeral and is wiped on container recycling or redeployments.

This target implements and verifies the production Cloud Object Storage adapter (AWS S3, Cloudflare R2, or Supabase Storage) with client-side image compression and secure upload handling.

---

## 2. 📋 Scope of Work

### Phase 1: S3 / Cloudflare R2 Storage Adapter (src/lib/storage/s3Provider.ts)
- Implement S3StorageProvider adhering to StorageProvider interface (uploadFile, deleteFile, getPublicUrl).
- Support S3-compatible custom endpoints (AWS_S3_ENDPOINT) for Cloudflare R2, Supabase Storage, or MinIO.
- Implement automated retry logic and network failure handling.

### Phase 2: Magic Byte MIME Verification & Security
- In src/app/api/upload/route.ts:
  - Inspect file magic bytes (signatures for JPEG FF D8 FF, PNG 89 50 4E 47, WebP 52 49 46 46) to prevent extension-spoofing attacks.
  - Enforce maximum upload payload limit (5MB).

### Phase 3: Client-Side WebP Compression Pipeline
- Ensure all photos uploaded via src/components/admin/ImageUpload.tsx run through src/lib/client/imageOptimization.ts before hitting the server action or upload route.
- Resize to max 1920px width and convert to WebP at 85% quality when supported.

---

## 3. 🧪 Testing & Verification Plan

1. **Unit Tests (	ests/unit/storage.test.ts)**:
   - Mock S3 client upload and deletion calls.
   - Test MIME magic byte detection with valid and spoofed binaries.
   - Verify fallback handling when cloud credentials are missing in development.
2. **Quality Gates**:
   - 
pm test passes.
   - 
px tsc --noEmit clean.
