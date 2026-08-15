# Revised Task 01: Database, Schema with Soft Deletes & Config

## 1. Remote Image Configuration (`next.config.ts`)
Enable remote image domains for Unsplash, Supabase, Cloudinary, and media CDNs:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
```

## 2. Updated Prisma Schema (`prisma/schema.prisma`)
Supports soft deletes (`isArchived`, `deletedAt`), composite indexes, and relational integrity with `AdoptionApplication`:

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  COORDINATOR
  STAFF
  VOLUNTEER
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  role         Role     @default(STAFF)
  pinHash      String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}

model Pet {
  id              String                @id @default(cuid())
  name            String
  species         String                // dog, cat, other
  breed           String
  age             String
  ageCategory     String                // puppy_kitten, young, adult, senior
  gender          String                // Male, Female
  size            String                // Small, Medium, Large
  weight          String
  status          String                @default("Available") // Available, Pending, Adopted
  adoptionFee     String
  description     String
  rescueStory     String
  image           String
  galleryImages   String[]
  tags            String[]
  featured        Boolean               @default(false)
  intakeDate      String
  
  // Medical clearance
  vaccinated      Boolean               @default(true)
  microchipped    Boolean               @default(true)
  spayedNeutered  Boolean               @default(true)
  specialNeeds    String?

  // Compatibility
  goodWithDogs    Boolean               @default(true)
  goodWithCats    Boolean               @default(true)
  goodWithKids    Boolean               @default(true)
  energyLevel     String                @default("Moderate")

  // Soft deletion & audit
  isArchived      Boolean               @default(false)
  deletedAt       DateTime?

  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  applications    AdoptionApplication[]

  @@index([species, status, isArchived])
  @@index([isArchived, status])
  @@index([featured])
  @@map("pets")
}

model AdoptionApplication {
  id                  String   @id @default(cuid())
  petId               String?
  pet                 Pet?     @relation(fields: [petId], references: [id], onDelete: SetNull)
  petName             String
  petBreed            String?
  applicantName       String
  email               String
  phone               String
  address             String
  housingType         String
  hasFencedYard       String
  currentPets         String
  currentPetDetails   String?
  householdExperience String
  applicantNotes      String?
  status              String   @default("SUBMITTED") // SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
  adminReviewNotes    String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([petId, status])
  @@index([email])
  @@map("adoption_applications")
}

model AuditLog {
  id           String   @id @default(cuid())
  action       String
  actorId      String?
  actorEmail   String
  actorRole    String
  targetEntity String
  targetId     String?
  details      String
  metadata     Json?
  createdAt    DateTime @default(now())

  @@index([createdAt])
  @@index([actorEmail])
  @@map("audit_logs")
}

model ShelterSettings {
  id                 String   @id @default("default-settings")
  shelterName        String   @default("Hope for Strays")
  email              String   @default("info@hopeforstrays.org")
  phone              String   @default("03-7876 5432")
  address            String   @default("No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia")
  operatingHours     String   @default("Tuesday – Sunday: 10:00 AM – 5:00 PM")
  announcementBanner String?
  adoptionFeeDog     String   @default("RM 180")
  adoptionFeeCat     String   @default("RM 95")
  updatedAt          DateTime @updatedAt

  @@map("shelter_settings")
}
```

## 3. Database Commands
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```
