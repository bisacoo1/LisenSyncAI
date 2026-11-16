# LisenSync AI

**LisenSync AI: An AI-Powered BS Pharmacy (PhLE) Licensure Exam Reviewer and Mock Assessment System**

A specialized study and assessment platform focused on **BS Pharmacy** and the **PRC Pharmacist Licensure Examination (PhLE)** across all 6 official board modules (Pharmaceutical Chemistry, Pharmacognosy, Practice of Pharmacy, Pharmacology-Pharmacokinetics, Pharmaceutics, and Quality Assurance/Quality Control), aligned to the 75% PRC passing benchmark.

## Stack
- React + TypeScript + Vite
- Supabase (Auth, Postgres, Storage, RLS)
- Gemini API for AI generation (configurable)

## Core Features
- **BS Pharmacy (PhLE) Study Setup**: Pre-configured around all 6 official Pharmacist Licensure Examination modules, TOS weights, prompts, and readiness analytics.
- **Reviewer-to-Flashcards & Drills**: Upload Pharmacy review handouts/PDFs; AI extracts text and generates active-recall flashcards and situational drills tagged by PhLE module.
- **PhLE-Style Assessment Modes**:
  - Situational MCQs with higher-order clinical and pharmaceutical science thinking and step-by-step rationales
  - Clinical & Concept Diagnosis (identify drug class, mechanism, disease, principle, pharmacy law, or formula from scenarios)
  - Priority & Sequence Ordering (arrange dispensing, compounding, QC, or clinical procedures in correct order)
- **Timed 6-Module PhLE Mock Simulation**: Multi-module mock aligned to the PRC Table of Specifications (TOS), 300-minute countdown timer, no instant answers until submission.
- **Readiness Analytics**: Scores per PhLE module, weak-topic flags, and targeted remediation drills toward the 75% passing mark.

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
