# Pharmora AI

Pharmora AI is a study companion for BS Pharmacy students and Pharmacist Licensure Examination (PhLE) candidates. It turns reviewers into practice material, tracks study progress, and provides a timed board-exam simulation.

## Product direction

The product should use **one account and one sign-in experience**. Course Mode is the primary study workspace, and the PhLE mock board exam should be available as a function inside that workspace—not as a separate PhLE account.

The current app already uses a shared email/password authentication system, but registration and onboarding still ask users to choose between a **Course** and **Board exam** study track. That choice currently changes some labels, study tools, analytics, and navigation; the mock exam is currently exposed on the board track. This distinction is the remaining product flow to consolidate.

## Features

### Accounts and study setup

- Register and sign in with one account.
- Complete an initial profile with a name, study track, and optional PhLE target date; choose a preset avatar or upload a profile photo and select an avatar border.
- Use a protected workspace with a dashboard and saved study data.
- Choose a light or dark workspace theme.

### Reviewers and study materials

- Upload PDF, DOCX, PPT/PPTX, and image materials (JPG/JPEG, PNG, WebP, HEIC, or HEIF), use a camera or photo library, or paste notes as text.
- Save uploaded materials as reviewers in a private account library.
- In the current Course Mode, saving course material automatically generates flashcards, multiple-choice questions, identification prompts, and enumeration questions when AI generation is configured.
- In the current Board exam track, assign a reviewer to a PhLE subject and generate flashcards and practice questions for that subject.
- Create subject folders, move reviewer sets between folders, and open a reviewer in the side-by-side reader.
- Share generated reviewer study sets with friends. Sharing copies the generated questions and flashcards; it does not share the uploaded source file or extracted source text.

### Practice and study tools

Choose a reviewer and study set from **My Reviewers**, or start a practice session from the dashboard:

- **Study Mode:** Review flashcards with spaced-repetition scheduling and due-card tracking.
- **Exam Mode:** Answer multiple-choice questions, receive grading, and review explanations.
- **Diagnosis:** Recall a clinical concept from a scenario or prompt.
- **Sequence:** Put steps or priorities in the correct order.
- **Identification:** Type a term or concept from memory (Course Mode).
- **Enumeration:** Recall the requested items in a list (Course Mode).

Available modes depend on the generated study material and the current study track. Practice sessions update the learner’s progress and analytics.

### PhLE mock board exam

The current board-track mock exam is a 660-minute timed simulation across six PhLE modules, weighted to the PRC Table of Specifications. It draws from the learner’s generated practice bank, hides answers and rationales until submission or time expiry, and shows results with answer explanations afterward. The current pass rule is at least 75% overall, with no module below 50%. Results contribute to readiness analytics.

As part of the product direction above, this exam should become available from Course Mode under the same account, rather than depending on a separate board-track entry flow.

### Dashboard, analytics, and progress

- See daily study goals, current and longest streaks, due flashcards, and a personalized study roadmap with an optional AI-selected focus area.
- Review course-subject trends or PhLE readiness, depending on the selected track.
- Track practice accuracy by subject/module and by study mode, see recent changes, identify weak areas, and return to targeted practice.
- Earn XP and levels through study activity; progress is stored with the learner profile.
- Review seven achievement milestones and their completion progress.

### Game mode

**Rx Runner** is an arcade-style study game. Learners move between lanes, jump, or slide to avoid obstacles and answer multiple-choice checkpoints created from their practice material. Sound can be toggled, and a run can be restarted after it ends. Generated MCQ checkpoints are required to unlock the game.

### Friends and leaderboards

- Browse weekly or monthly study leaderboards (Philippine time) and view learner profiles.
- Send, accept, decline, or remove friend connections.
- Share a reviewer or a subject folder’s generated study sets with a friend.

### AI reading and help

- Read a saved reviewer alongside an AI study assistant.
- Select document text to request an AI explanation or save a highlight.
- Ask follow-up questions about the reviewer in the reader, or open **Ask Lilo** for Pharmacy study help and navigation guidance.
- Use AI-generated reviewer content and answers only when a valid Gemini API key is configured.

## Main user flow

1. Visit the landing page and create an account. There is one shared authentication system; the current registration flow also selects a Course or Board exam study track.
2. Sign in, then complete onboarding with a display name and optional exam date.
3. Use the dashboard to see study priorities, progress, and links into the study workspace.
4. Upload a reviewer, choose a file/photo or paste text, then save it. Generated study sets become available in My Reviewers.
5. Organize reviewers into subject folders, choose a study mode, and complete practice or flashcard sessions.
6. Check the dashboard and Analytics for accuracy, trends, weak subjects, streaks, and milestone progress; use those signals to choose what to study next.
7. Connect with friends, compare leaderboard progress, and share generated study sets.
8. For the current Board exam track, start the timed PhLE mock exam from the Mock Exam page. The intended consolidated flow is to access this same exam from Course Mode.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page and study-track overview |
| `/register`, `/login` | Shared account creation and sign-in |
| `/onboarding` | Initial profile and study setup |
| `/dashboard` | Daily study summary, roadmap, and progress |
| `/reviewers` | Saved reviewer library and subject folders |
| `/reviewer` | Upload materials and manage reviewer generation |
| `/practice` | Flashcard and practice sessions |
| `/mock` | Current PhLE mock exam flow |
| `/side-by-side`, `/side-by-side/:materialId` | Reviewer reader, AI help, and highlights |
| `/game` | Rx Runner game |
| `/analytics` | Study performance and readiness insights |
| `/leaderboard`, `/friends` | Learner rankings, profiles, and friend connections |
| `/achievements` | Achievement milestones and progress |

Workspace routes require authentication. The current track selection can affect which workspace features and navigation items appear.

## Technology

- React, TypeScript, and Vite
- Supabase Auth, Postgres, Storage, and row-level security
- Gemini API for AI-assisted study generation and help

## Local setup

### Prerequisites

- Node.js and npm
- A Supabase project
- A Gemini API key for AI features

### Install and configure

```bash
npm install
```

Copy `.env.example` to `.env` and set the project values:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_GEMINI_MODEL=gemini-3.5-flash-lite
```

`VITE_GEMINI_MODEL` is optional; the application has a default model. Variables prefixed with `VITE_` are included in the client bundle. Treat the Gemini key as browser-exposed: restrict it appropriately and do not put a privileged server-side key in this file.

### Set up Supabase

1. Create a Supabase project and configure its Auth settings for the app’s sign-up and sign-in flow.
2. For a new database, run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor. It is the consolidated setup and creates the tables, row-level security policies, and private `review-materials` and `profile-avatars` Storage buckets used by the app.
3. For an existing database, apply any migrations that have not yet been run, in filename order, from [`supabase/migrations/`](./supabase/migrations/).
4. Add the project URL and anon/public key to `.env`. Never use the Supabase service-role key in the browser app.

The schema limits reviewer uploads to 10 MB and profile-avatar uploads to 5 MB.

### Run the app

```bash
npm run dev
```

Vite prints the local development URL. To verify a production build:

```bash
npm run build
```

Other project commands:

```bash
npm run lint     # TypeScript check
npm test         # Run Vitest tests
npm run preview  # Preview the production build
```

AI features report a configuration error when `VITE_GEMINI_API_KEY` is missing. The rest of the app can be built, but authentication and saved user data require valid Supabase configuration. Scanned or image-only PDFs may yield limited extracted text.

## Project structure

```text
src/
  components/  Shared layouts, navigation, AI helpers, and UI components
  context/     Authentication and profile context
  hooks/       Reusable React hooks
  lib/         AI, Supabase, study progress, analytics, and application helpers
  pages/       Route-level screens
  types/       Shared TypeScript types
supabase/
  schema.sql   Consolidated database, policy, and storage setup
  migrations/  Incremental database changes
tests/         Vitest test suites
```
