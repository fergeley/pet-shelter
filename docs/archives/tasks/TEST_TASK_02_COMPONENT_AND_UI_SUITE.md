# Task 02: Client Component & UI Testing Suite

**Date**: 2026-08-26  
**Status**: Ready for Dispatch  
**Domain**: Frontend UI/UX & Component Testing  
**Dependencies**: Task 01 — landed. Read "Infrastructure already in place" below before starting.  
**Target Files**:
- `tests/setup/componentSetup.ts` (jsdom & `@testing-library/jest-dom` registration)
- `tests/components/AdoptionModal.test.tsx` (Adoption modal & multi-step validation)
- `tests/components/PetMatchQuiz.test.tsx` (Quiz interaction & recommendation calculations)
- `tests/components/LanguageToggle.test.tsx` (LanguageProvider & UI dictionary switching)
- `tests/components/AdminPetTable.test.tsx` (Admin table filtering, search, and pagination)

---

## 🎯 1. Objective

Build an interactive client component testing suite using `@testing-library/react`, `@testing-library/user-event`, and `jsdom` under Vitest. Ensure all tests interact strictly through user-facing accessibility cues (`getByRole`, `getByLabelText`) to guarantee tests remain non-brittle across future refactorings.

---

## 🔍 2. Detailed Technical Specification

### A. Infrastructure already in place (do not rebuild it)

Task 01 landed the `components` lane. Three things are done, and redoing them will fight the config:

- **`jsdom` is installed** and the `components` project in `vitest.config.mts` already sets
  `environment: "jsdom"` for `tests/components/**/*.test.{ts,tsx}`. Do **not** add
  `// @vitest-environment jsdom` docblocks, and do **not** add a `workspace` key — `workspace` is
  deprecated in Vitest 4 in favour of `projects`, which is what this config uses.
- **`tests/setup/nextMocks.ts` loads before every component test**, so `useRouter()`,
  `usePathname()`, `useSearchParams()`, `cookies()` and `revalidatePath()` are already mocked. Do
  not re-mock them per file. `setMockLocation(pathname, search)` points the navigation hooks at a
  URL; `routerMock` exposes `push`/`replace`/`refresh` spies, cleared between tests.
- **State is reset before every test** by that same harness. Do not add your own store resets.

### B. Environment & Setup (`tests/setup/componentSetup.ts`)
- Install dev dependencies (`jsdom` is already present — do not reinstall):
  - `@testing-library/react`
  - `@testing-library/user-event`
  - `@testing-library/jest-dom`
- Configure `componentSetup.ts` to import `@testing-library/jest-dom/vitest`, and add
  `@testing-library/react`'s `cleanup()` to an `afterEach` — jsdom state is not reset by the
  Task 01 harness, which only resets `src/lib` module caches.
- **Register it**: append `"./tests/setup/componentSetup.ts"` to `setupFiles` on the `components`
  project in `vitest.config.mts`. Creating the file alone does nothing — `setupFiles` currently
  lists only `nextMocks.ts`, and the jest-dom matchers will be missing at runtime with a
  confusing "not a function" error rather than a helpful one.

### C. Component Test Suites to Implement

#### 1. `tests/components/AdoptionModal.test.tsx`
- **Target Component**: `AdoptionModal` or `AdoptionForm` (`src/components/features/adoptions/AdoptionModal.tsx` & `useAdoptionFormController.ts`).
- **Test Cases**:
  1. Renders adoption dialog when opened with designated pet information pre-filled.
  2. Submitting empty form displays inline validation errors on required fields (Applicant Name, Email, Phone, Address, Agreement to Terms).
  3. Rejects invalid Malaysian phone number formats and displays error.
  4. Entering valid input allows successful form progression and triggers submission callback.
  5. Shows loading / disabled state on submit button during active submission.

#### 2. `tests/components/PetMatchQuiz.test.tsx`
- **Target Component**: `PetMatchQuiz` (`src/components/features/pets/PetMatchQuiz.tsx` or quiz dialog).
- **Test Cases**:
  1. Renders the first question and advances when an option is selected.
  2. Selecting answers calculates scores using `matchEngine.ts` and renders matching pet cards.
  3. Clicking a recommendation opens the corresponding pet view or adoption trigger.

#### 3. `tests/components/LanguageToggle.test.tsx`
- **Target Component**: `LanguageProvider` (`src/components/providers/LanguageProvider.tsx`).
- **Test Cases**:
  1. Default language renders English (`en`) strings.
  2. Toggling to Bahasa Malaysia (`ms`) updates consumer components with Malaysian text.
  3. Persists language preference to `localStorage` and updates document cookie.

#### 4. `tests/components/AdminPetTable.test.tsx`
- **Target Component**: `PetDataTable` (`src/components/admin/PetDataTable.tsx`).
- **Test Cases**:
  1. Renders list of pets with columns (Name, Species, Status, Age, Actions).
  2. Typing into search input filters table rows in real-time.
  3. Changing status filter dropdown (e.g. `In Rehabilitation`) filters rows accordingly.
  4. Action buttons (Edit, Archive) trigger expected callbacks with correct pet ID.

---

## 🚦 3. Acceptance Criteria & Verification

1. [ ] Accessible queries are used throughout (`getByRole`, `getByLabelText`, `getByPlaceholderText`). Zero tests query CSS class names.
2. [ ] All 4 component test files pass via `npm run test:components`.
3. [ ] `npx tsc --noEmit` is clean outside `scratch/`.

---

## 🤖 4. Autonomous Agent Execution Prompt

```text
You are a senior Frontend Test Engineer specializing in React 19, TypeScript, and React Testing Library. Execute Task 02 for the Hope for Strays pet shelter platform according to docs/tasks/TEST_TASK_02_COMPONENT_AND_UI_SUITE.md.

Step 0: Read §2.A first. Task 01 already installed jsdom, already routes tests/components/** to the jsdom environment via the `components` project in vitest.config.mts, and already mocks next/navigation, next/headers and next/cache globally. Do not re-add any of it, and do not introduce a `workspace` key — Vitest 4 uses `projects`.
Step 1: Install `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom` as devDependencies. jsdom is already installed.
Step 2: Create `tests/setup/componentSetup.ts` importing `@testing-library/jest-dom/vitest` plus an afterEach cleanup(), and REGISTER it by appending it to setupFiles on the `components` project in vitest.config.mts. The file does nothing until it is registered.
Step 3: Implement `tests/components/AdoptionModal.test.tsx` testing validation errors, Malaysian phone checks, and submission states.
Step 4: Implement `tests/components/PetMatchQuiz.test.tsx` testing quiz question progression and match results.
Step 5: Implement `tests/components/LanguageToggle.test.tsx` testing English / Bahasa Malaysia switching.
Step 6: Implement `tests/components/AdminPetTable.test.tsx` testing search, status filtering, and action callbacks.
Step 7: Run `npm run test:components` and `npx tsc --noEmit` to verify all tests pass with zero TypeScript errors. Then run `npm run test:all` to confirm you have not disturbed the 357 unit tests — a change to shared setupFiles or to vitest.config.mts affects every lane, not just yours.
```
