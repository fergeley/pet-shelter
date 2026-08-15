# Task 01: Database Setup, Prisma Schema, and Server Actions

## Objective
Connect the pet-shelter Next.js app to PostgreSQL via Prisma ORM, seed the initial pet data from `src/data/pets.json`, and replace static JSON data fetching with type-safe Server Actions.

## Requirements
1. **Prisma Schema (`prisma/schema.prisma`):**
   - Configure PostgreSQL provider and Prisma Client generator.
   - Define `Pet` model:
     - `id`: String (cuid or uuid, primary key)
     - `name`: String
     - `species`: Enum (`DOG`, `CAT`, `OTHER`)
     - `breed`: String
     - `age`: String
     - `gender`: Enum (`MALE`, `FEMALE`)
     - `size`: Enum (`SMALL`, `MEDIUM`, `LARGE`)
     - `tags`: String[]
     - `description`: String (Text)
     - `images`: String[]
     - `status`: Enum (`AVAILABLE`, `PENDING`, `ADOPTED`) - default `AVAILABLE`
     - `createdAt`: DateTime (default now)
     - `updatedAt`: DateTime (updatedAt)
     - Relation to `AdoptionApplication[]`
   - Define `AdoptionApplication` model:
     - `id`: String (primary key)
     - `petId`: String (foreign key to Pet)
     - `applicantName`: String
     - `email`: String
     - `phone`: String
     - `livingSituation`: String
     - `hasCurrentPets`: Boolean
     - `message`: String? (Text)
     - `status`: Enum (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`) - default `SUBMITTED`
     - `createdAt`: DateTime (default now)

2. **Database Client (`src/lib/prisma.ts`):**
   - Export a singleton Prisma client instance adhering to Next.js development hot-reloading practices.

3. **Database Seeding (`prisma/seed.ts`):**
   - Write a seed script that reads `src/data/pets.json` and inserts records into the database.
   - Add `"prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }` to `package.json`.

4. **Server Actions (`src/actions/pets.ts`):**
   - `getPets(filters?: { species?: string; status?: string; search?: string })`: Fetches filtered pet list.
   - `getPetById(id: string)`: Fetches a single pet by ID.
   - `submitAdoptionApplication(data: AdoptionApplicationInput)`: Validates via Zod and creates an application record.

5. **Update Public Pages:**
   - Update `src/app/page.tsx` and `src/app/pets/page.tsx` to fetch data via `getPets()` instead of importing `pets.json`.
