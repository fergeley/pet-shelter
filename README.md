# Hope for Strays (Petaling Jaya, Selangor) — Rescue & Adoption Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A modern, accessible, and high-performance pet adoption web application built with **Next.js App Router**, **TypeScript**, **Tailwind CSS v4**, **shadcn UI / Base UI**, and **React Hook Form + Zod**. Designed to connect rescue animals with loving forever families through client-side faceted filtering, detailed pet profiles, and an adoption application workflow.

---

## 🏗️ Architecture Overview

The application follows clean architecture and component isolation principles to guarantee maintainability, high performance, and accessibility:

### 1. Framework & Runtime
- **Next.js App Router (Turbopack)**: Leverages React Server Components (RSC) for page structure and metadata generation alongside optimized Client Components for interactive workflows.
- **Strict TypeScript Typing**: Centralized type domain (`src/types/pet.ts`) enforcing full end-to-end type safety across mock data schemas, filter states, and form submissions.
- **Tailwind CSS v4 + OKLCH Design Tokens**: Modern inline theme system utilizing perceptual color spaces (`oklch`) for seamless light/dark theme contrast and fluid typography.

### 2. Component Isolation & State Architecture
- **Atomic UI Primitives (`src/components/ui/`)**: Decoupled, headless UI primitives powered by `@base-ui/react` and `class-variance-authority` (Dialog, Sheet, Button, Input, Card, Textarea).
- **Business Domain Components (`src/components/`)**:
  - `Hero.tsx`: Shelter mission, visiting hours, and call-to-action triggers.
  - `PetGallery.tsx`: Self-contained faceted search and filtering engine.
  - `PetCard.tsx`: Optimized visual card with hover feedback, status indicators, and quick actions.
  - `PetDetailDialog.tsx`: Accessible modal dialog displaying rescue stories, veterinary clearance checklists, and household compatibility matrices.
  - `AdoptionForm.tsx`: Type-safe multi-section application form with reactive state tracking via `useWatch`.
  - `Navbar.tsx` & `Footer.tsx`: Responsive navigation shell with mobile menu drawer and emergency contact helplines.

### 3. Accessibility & WAI-ARIA Standards
- **Screen Reader Support**: Accessible hidden labels (`sr-only`), `aria-invalid` bindings, and semantic header structures (`<DialogTitle>`, `<DialogDescription>`).
- **Keyboard Navigation**: Full focus trapping, Tab navigation, and `Escape` key dismissal on all modal dialogs and slide-over sheets.
- **Accessible Contrast**: Carefully calibrated text-to-background contrast ratios compliant with WCAG 2.1 AA guidelines.

---

## ✨ Key Features

### 🔍 Client-Side Faceted Search & Filtering
- **Multi-Factor Criteria**: Filter animals simultaneously by **Species** (Dogs, Cats), **Age Stage** (Puppy/Kitten, Young, Adult, Senior), **Size** (Small, Medium, Large), and **Adoption Status** (Available, Pending).
- **Instant Search Bar**: Sub-millisecond text search matching names, breeds, traits, and descriptions with instant clear actions.
- **1-Click Quick Tags**: Dedicated filter chips for popular traits like *"Kid-Friendly"*, *"House-Trained"*, *"Gentle"*, and *"Playful"*.
- **Reactive Result Counter & Empty State**: Live feedback on matching pets with 1-click filter reset.

### 📋 Type-Safe Adoption Form (React Hook Form + Zod)
- **Zod Schema Validation**: Client-side schema checking for required applicant contact info, valid email, minimum phone number digits, and agreement verification.
- **Applicant Lifestyle & Housing Vetting**: Captures housing type (owned/rented with yard, apartment, condo), fenced yard status, current household pets, and past pet ownership experience.
- **Dynamic Pet Association**: Pre-selects the chosen pet from any card or allows manual selection from a dropdown.
- **Celebratory Success Confirmation**: Simulates asynchronous submission with loading spinner state and presents clear next steps for the applicant.

### ⚡ Performance & Image Optimization
- **Next.js Image Optimization**: Configured with `images.unsplash.com` remote patterns, responsive `sizes` queries, and aspect-ratio protection against Cumulative Layout Shift (CLS).
- **Static Page Pre-Rendering**: Optimized production bundle with pre-rendered static routes for instant page loads.
- **Smooth Anchor Navigation**: Smooth scrolling support for internal page sections (`#how-it-works`, `#mission`, `#support`).

---

## 📂 Project Structure

```plaintext
pet-shelter/
├── public/                     # Static assets and icons
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Global root layout (Navbar, Footer, Google Fonts)
│   │   ├── page.tsx            # Home page (Hero, Featured Pets, How It Works, Testimonials, CTA)
│   │   ├── pets/
│   │   │   └── page.tsx        # Searchable pet directory & adoption FAQ
│   │   └── globals.css         # Tailwind v4 configuration and color design tokens
│   ├── components/
│   │   ├── ui/                 # Headless UI primitives (Button, Card, Dialog, Sheet, etc.)
│   │   ├── Navbar.tsx          # Responsive navigation header
│   │   ├── Footer.tsx          # Shelter footer with hours and emergency contacts
│   │   ├── Hero.tsx            # Hero section with headline and shelter metrics
│   │   ├── PetCard.tsx         # Pet card component with status badge & actions
│   │   ├── PetDetailDialog.tsx # Pet profile dialog with rescue story & medical checklist
│   │   ├── PetGallery.tsx      # Faceted search & filter gallery
│   │   └── AdoptionForm.tsx    # Adoption application form with Zod validation
│   ├── data/
│   │   └── pets.json           # Mock pet directory data with Unsplash photography
│   ├── lib/
│   │   └── utils.ts            # ClassName merging helper (clsx + tailwind-merge)
│   └── types/
│       └── pet.ts              # TypeScript interfaces for pets, filters, and adoption form
├── next.config.ts              # Next.js configuration & remote image patterns
├── package.json                # Project dependencies & scripts
├── tsconfig.json               # TypeScript compiler options
└── README.md                   # Project documentation
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: `v18.18.0` or higher (Node 20+ recommended)
- **Package Manager**: `npm`, `yarn`, `pnpm`, or `bun`

### Installation & Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/pet-shelter.git
   cd pet-shelter
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

### Build & Lint Commands

- **Run linter check**:
  ```bash
  npm run lint
  ```
- **Build production bundle**:
  ```bash
  npm run build
  ```
- **Start production server**:
  ```bash
  npm run start
  ```

---

## ☁️ Deployment

### Option 1: Deploy to Vercel (Recommended)

1. **Via Vercel CLI**:
   ```bash
   npx vercel
   ```
   Follow the prompts to link your account and deploy. Deploy to production using:
   ```bash
   npx vercel --prod
   ```

2. **Via GitHub Integration (Automatic CI/CD)**:
   - Push your code to a GitHub repository:
     ```bash
     git add .
     git commit -m "feat: complete pet shelter application"
     git push origin main
     ```
   - Go to [Vercel](https://vercel.com) and click **"Add New..." > "Project"**.
   - Select your `pet-shelter` repository.
   - Vercel automatically detects Next.js. Click **"Deploy"**.

### Option 2: Deploy to Netlify

1. Push your repository to GitHub / GitLab.
2. Log in to [Netlify](https://www.netlify.com) and select **"Add new site" > "Import an existing project"**.
3. Select your repository. Netlify will detect Next.js with `@netlify/plugin-nextjs`.
4. Click **"Deploy Site"**.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
