# Task 02: Admin Dashboard and Pet CRUD Operations

## Objective
Build a staff management dashboard at `/admin/pets` with a data table, search/filter controls, and a modal form to create, edit, and delete pet records.

## Requirements
1. **Admin Layout (`src/app/admin/layout.tsx`):**
   - Create a clean sidebar or top navigation with links:
     - Pets Management (`/admin/pets`)
     - Adoption Applications (`/admin/applications`)
     - View Public Site (`/`)

2. **Pet Data Table (`src/app/admin/pets/page.tsx`):**
   - Use `@tanstack/react-table` with Tailwind styling to display:
     - Image thumbnail
     - Name & Breed
     - Species & Age
     - Status Badge (Available = green, Pending = amber, Adopted = slate)
     - Actions: Edit button, Status quick-toggle, Delete button with confirmation dialog.
   - Include toolbar with:
     - Text search (by name or breed).
     - Status filter dropdown.
     - "Add New Pet" button opening `PetFormDialog`.

3. **Add/Edit Pet Modal (`src/components/admin/PetFormDialog.tsx`):**
   - Build a dialog form using `react-hook-form` + `zod` for validation (`src/lib/validations/pet.ts`).
   - Fields: Name, Species, Breed, Age, Gender, Size, Status, Description, Tags (multi-badge input), Image URLs (array).
   - Support both Create and Edit modes (pass optional `pet` prop).
   - On submit, trigger Server Action `createPet` or `updatePet` with revalidation of `/pets` and `/admin/pets`.
