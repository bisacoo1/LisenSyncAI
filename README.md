# LisenSync AI

**LisenSync AI: An AI-Powered Licensure Exam Reviewer and Mock Assessment System**

A specialized study and assessment platform for PRC board exam programs (e.g. BS Criminology, BS Pharmacy, BS Civil Engineering), focused on licensure exam readiness and the 75% PRC passing benchmark.

## Stack
- React + TypeScript + Vite
- Supabase (Auth, Postgres, Storage, RLS)
- OpenAI-compatible API for AI generation (configurable)

## Core Features
- **Board Program Onboarding**: Select licensure program; subjects, prompts, and analytics align to official board syllabus.
- **Reviewer-to-Flashcards & Drills**: Upload review handouts/PDFs; AI extracts text and generates active-recall flashcards and situational drills tagged by board subject.
- **PRC-Style Assessment Modes**:
  - Situational MCQs with higher-order thinking and step-by-step rationales
  - Case & Concept Diagnosis (identify principle, disease, law, or formula from scenarios)
  - Priority & Sequence Ordering (arrange procedures/interventions in correct order)
- **Timed Board Exam Mock Simulation**: Multi-subject mock aligned to Table of Specifications (TOS), countdown timer, no instant answers until submission.
- **Readiness Analytics**: Scores per board subject, weak-topic flags, and targeted remediation drills toward the 75% passing mark.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   copy .env.example .env
   ```
   Fill in Supabase and AI API values.

3. **Provision Supabase**
   - Create a Supabase project.
   - Run the SQL in `supabase/schema.sql` in the SQL editor.
   - Create a Storage bucket named `reviewers` (private) for PDF uploads.

4. **Run locally**
   ```bash
   npm run dev
   ```

## Project Structure
- `src/pages/` - Route-level pages (onboarding, dashboard, reviewer upload, practice modes, mock exam, analytics)
- `src/components/` - Reusable UI components
- `src/lib/` - Supabase client, AI generation, syllabus/TOS data, analytics helpers
- `src/context/` - Auth and profile context
- `src/types/` - Shared TypeScript types
- `supabase/schema.sql` - Database schema and RLS policies

## Notes
- AI generation requires a valid API key; without it the app runs but generation actions will show a configuration error.
- PDF text extraction is performed client-side; scanned/image-only PDFs may yield limited text.
- Syllabus/TOS data included is a representative starter set and should be reviewed/expanded per official PRC syllabi.
