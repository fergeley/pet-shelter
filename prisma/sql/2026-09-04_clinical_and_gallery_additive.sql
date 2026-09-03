-- Additive migration: Clinical domain, Tags, Media Gallery & Compatibility Rules
--
-- Created: 2026-09-04
-- Models: Veterinarian, MedicalProcedureCategory, VetSpecialization, VetPetAssignment,
--         PetTag, PetTagAssignment, PetGalleryImage, PetCompatibilityRule
--
-- Every statement below is additive and idempotent: re-running it is a no-op.
--
--     npx prisma db execute --file prisma/sql/2026-09-04_clinical_and_gallery_additive.sql

BEGIN;

-- 1. Create veterinarians table
CREATE TABLE IF NOT EXISTS "veterinarians" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "clinicName"    TEXT,
    "phone"         TEXT,
    "email"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veterinarians_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "veterinarians_licenseNumber_key"
    ON "veterinarians"("licenseNumber");

-- 2. Create medical_procedure_categories table
CREATE TABLE IF NOT EXISTS "medical_procedure_categories" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "nameMs"      TEXT,
    "description" TEXT,

    CONSTRAINT "medical_procedure_categories_pkey" PRIMARY KEY ("id")
);

-- 3. Create vet_specializations table
CREATE TABLE IF NOT EXISTS "vet_specializations" (
    "vetId"       TEXT NOT NULL,
    "categoryId"  TEXT NOT NULL,
    "certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_specializations_pkey" PRIMARY KEY ("vetId", "categoryId")
);

-- 4. Create vet_pet_assignments table
CREATE TABLE IF NOT EXISTS "vet_pet_assignments" (
    "vetId"      TEXT NOT NULL,
    "petId"      TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPrimary"  BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vet_pet_assignments_pkey" PRIMARY KEY ("vetId", "petId")
);

-- 5. Create pet_tags table
CREATE TABLE IF NOT EXISTS "pet_tags" (
    "id"       TEXT NOT NULL,
    "name"     TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "pet_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pet_tags_name_key"
    ON "pet_tags"("name");

-- 6. Create pet_tag_assignments table
CREATE TABLE IF NOT EXISTS "pet_tag_assignments" (
    "petId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "pet_tag_assignments_pkey" PRIMARY KEY ("petId", "tagId")
);

-- 7. Create pet_gallery_images table
CREATE TABLE IF NOT EXISTS "pet_gallery_images" (
    "id"           TEXT NOT NULL,
    "petId"        TEXT NOT NULL,
    "url"          TEXT NOT NULL,
    "caption"      TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_gallery_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pet_gallery_images_petId_displayOrder_idx"
    ON "pet_gallery_images"("petId", "displayOrder");

-- 8. Create pet_compatibility_rules table
CREATE TABLE IF NOT EXISTS "pet_compatibility_rules" (
    "id"             TEXT NOT NULL,
    "petId"          TEXT NOT NULL,
    "housingType"    TEXT NOT NULL,
    "cohabitantType" TEXT NOT NULL,
    "isAllowed"      BOOLEAN NOT NULL DEFAULT true,
    "notes"          TEXT,

    CONSTRAINT "pet_compatibility_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pet_compatibility_rules_petId_idx"
    ON "pet_compatibility_rules"("petId");

CREATE UNIQUE INDEX IF NOT EXISTS "pet_compatibility_rules_petId_housingType_cohabitantType_key"
    ON "pet_compatibility_rules"("petId", "housingType", "cohabitantType");

-- 9. Add vetId column to medical_timeline_events
ALTER TABLE "medical_timeline_events"
    ADD COLUMN IF NOT EXISTS "vetId" TEXT;

CREATE INDEX IF NOT EXISTS "medical_timeline_events_vetId_idx"
    ON "medical_timeline_events"("vetId");

-- 10. Foreign Keys (guarded with pg_constraint checks for idempotence)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_timeline_events_vetId_fkey') THEN
        ALTER TABLE "medical_timeline_events"
            ADD CONSTRAINT "medical_timeline_events_vetId_fkey"
            FOREIGN KEY ("vetId") REFERENCES "veterinarians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vet_specializations_vetId_fkey') THEN
        ALTER TABLE "vet_specializations"
            ADD CONSTRAINT "vet_specializations_vetId_fkey"
            FOREIGN KEY ("vetId") REFERENCES "veterinarians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vet_specializations_categoryId_fkey') THEN
        ALTER TABLE "vet_specializations"
            ADD CONSTRAINT "vet_specializations_categoryId_fkey"
            FOREIGN KEY ("categoryId") REFERENCES "medical_procedure_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vet_pet_assignments_vetId_fkey') THEN
        ALTER TABLE "vet_pet_assignments"
            ADD CONSTRAINT "vet_pet_assignments_vetId_fkey"
            FOREIGN KEY ("vetId") REFERENCES "veterinarians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vet_pet_assignments_petId_fkey') THEN
        ALTER TABLE "vet_pet_assignments"
            ADD CONSTRAINT "vet_pet_assignments_petId_fkey"
            FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pet_tag_assignments_petId_fkey') THEN
        ALTER TABLE "pet_tag_assignments"
            ADD CONSTRAINT "pet_tag_assignments_petId_fkey"
            FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pet_tag_assignments_tagId_fkey') THEN
        ALTER TABLE "pet_tag_assignments"
            ADD CONSTRAINT "pet_tag_assignments_tagId_fkey"
            FOREIGN KEY ("tagId") REFERENCES "pet_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pet_gallery_images_petId_fkey') THEN
        ALTER TABLE "pet_gallery_images"
            ADD CONSTRAINT "pet_gallery_images_petId_fkey"
            FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pet_compatibility_rules_petId_fkey') THEN
        ALTER TABLE "pet_compatibility_rules"
            ADD CONSTRAINT "pet_compatibility_rules_petId_fkey"
            FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;
