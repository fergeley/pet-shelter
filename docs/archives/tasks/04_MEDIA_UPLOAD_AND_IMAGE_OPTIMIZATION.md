# Task 04: Media Upload & Image Optimization

## Objective
Replace raw image URL inputs with a functional image upload dropzone and optimize image rendering across public and admin views.

## Requirements
1. **Image Storage Integration (Uploadthing or Supabase Storage):**
   - Configure image upload endpoint for pet photos.
   - Create `src/components/admin/ImageUpload.tsx`:
     - Drag-and-drop file uploader.
     - Multi-image support (up to 4 images per pet).
     - Preview grid with delete buttons before saving.

2. **Next.js Image Optimization:**
   - Update `PetCard.tsx` and `PetDetailDialog.tsx` to use `next/image` with:
     - Explicit aspect ratio (`aspect-square` or `aspect-[4/3]`).
     - Responsive `sizes` attribute.
     - Fallback placeholder image when loading or if URL is invalid.
   - Add remote image host domains to `next.config.ts`.
