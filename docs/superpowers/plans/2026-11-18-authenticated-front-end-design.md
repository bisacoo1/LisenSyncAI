# Authenticated Front-End Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a calmer, pharmacy-specific authenticated workspace that emphasizes the next study action while preserving existing behavior.

**Architecture:** Keep the existing React, routing, Supabase, and CSS architecture. Change page markup only where hierarchy or labels need to move, and place visual treatment in `src/design.css` and existing page utility classes. No new components or dependencies.

**Tech Stack:** React 18, TypeScript, React Router, Vite, Vitest, CSS variables.

**Spec:** `docs/superpowers/specs/2026-11-18-authenticated-front-end-design.md`

## Global Constraints

- Preserve existing routes, study calculations, data queries, and theme persistence.
- Reuse existing UI components, icons, CSS variables, and responsive breakpoints.
- Preserve keyboard focus, field labels, live regions, reduced-motion support, and table scrolling.
- Use sentence case for descriptive section copy; reserve uppercase for compact navigation or status metadata.

## Review Focus

- Dark and light mode: task actions and table borders keep at least their existing contrast.
- Mobile at 680px and below: no page-level horizontal overflow and no controls collide.
- Empty, loading, and populated dashboard states: the next action remains the primary surface.
- Focused practice and mock exam: the main work area remains usable below 900px.
- Existing accessibility: no removal of labels, fieldsets, live regions, or focus styles.

---

### Task 1: Establish Workspace Hierarchy

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/design.css`

- [ ] **Step 1: Update mobile topbar markup in `src/components/Layout.tsx`**

Keep menu, brand, and page title. Hide the decorative mobile topbar label at 680px and below through CSS. Add `aria-hidden="true"` to the decorative label.

- [ ] **Step 2: Simplify the workspace topbar in `src/components/Layout.tsx`**

Keep date, program, and theme controls at desktop widths. Add a named CSS hook around the right-side metadata so mobile rules can remove it predictably.

- [ ] **Step 3: Add workspace hierarchy CSS in `src/design.css`**

Set the desktop topbar and content surface to use the existing variables:
- topbar remains separated from content by the existing border
- decorative topbar metadata is hidden below 680px
- page headings retain `DM Serif Display`
- descriptive section copy uses sentence case

- [ ] **Step 4: Verify shared workspace**

Run `npm run build` and `npm run test`.

**Expected:** build passes and existing tests pass.

---

### Task 2: Reorder and Clarify the Dashboard

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/design.css`

- [ ] **Step 1: Move the dashboard study plan ahead of readiness and momentum**

In `src/pages/DashboardPage.tsx`, move the existing `study-plan-section` block from its current position so it renders immediately after the dashboard heading and before the readiness/course overview block.

- [ ] **Step 2: Convert decorative dashboard labels to sentence case**

Change page and section kicker copy in `DashboardPage.tsx` that is purely descriptive, including “COURSEWORK DASHBOARD,” “BS PHARMACY OVERVIEW,” “THE LITTLE WINS,” “PICK UP WHERE YOU LEFT OFF,” and “THE SIX PhLE MODULES,” to sentence case. Preserve uppercase only for compact product metadata if it is already a branded label.

- [ ] **Step 3: Strengthen the next-study action**

Keep the first study-plan row visually dominant. In the existing `study-plan-list`, render all existing steps; the CSS may show only the first two steps with the existing data unchanged. Do not remove or hide study steps by changing state or navigation behavior.

- [ ] **Step 4: Reduce dashboard card decoration**

In `src/design.css`, add hierarchy-specific rules for:
- `.study-plan-section`
- `.study-plan-step`
- `.dashboard-feature-grid`
- `.momentum-card`
- `.toolkit-card`
- `.subject-panel`
- `.focus-panel`

Use the existing panel, border, primary, success, warning, and shadow variables. Use elevated treatment only for the primary study-plan action and keep secondary surfaces flat or lightly bordered.

- [ ] **Step 5: Verify dashboard states**

Run `npm run build` and `npm run test`.

**Expected:** build passes; no route or data behavior changes; dashboard markup compiles in loading and populated branches.

---

### Task 3: Refocus Practice and Mock Exam

**Files:**
- Modify: `src/pages/PracticePage.tsx`
- Modify: `src/pages/MockExamPage.tsx`
- Modify: `src/design.css`

- [ ] **Step 1: Convert practice control labels to sentence case**

Change descriptive labels and hints in `src/pages/PracticePage.tsx` while preserving exact mode values and control names. Use sentence case for labels such as “STUDY MODE,” and keep `ariaLabel="Practice mode"` unchanged.

- [ ] **Step 2: Keep practice work dominant**

In `src/design.css`, flatten the practice controls card after it is used and emphasize `.practice-question-card` or `.practice-flashcard` as the active surface. Keep `.practice-session-panel` and companion layout intact.

- [ ] **Step 3: Tighten mock-exam focus layout**

In `src/design.css`, retain `.timer`, question content, and answer navigation while:
- keeping the timer visible and readable
- preserving 44px minimum touch targets
- adding clear horizontal overflow behavior for the question navigator

- [ ] **Step 4: Verify practice and exam**

Run `npm run build` and `npm run test`.

**Expected:** existing fieldsets, live feedback, timers, and answer controls remain present.

---

### Task 4: Simplify Reader, Analytics, and Reviewers

**Files:**
- Modify: `src/pages/SideBySideReader.tsx`
- Modify: `src/pages/AnalyticsPage.tsx`
- Modify: `src/pages/ReviewerPage.tsx`
- Modify: `src/design.css`

- [ ] **Step 1: Give the reader a document-first hierarchy**

Preserve existing reader grid and split-pane behavior. Add CSS emphasis to `.reader-document`, `.reader-side-panel`, and `.reader-header` that keeps document content dominant and removes excessive card elevation.

- [ ] **Step 2: Flatten analytics decoration**

In `src/pages/AnalyticsPage.tsx` only change descriptive labels to sentence case where they are section copy. In `src/design.css`, make `.progress-insight` and table surfaces lighter and keep charts/tables as the strongest information.

- [ ] **Step 3: Clarify reviewer hierarchy**

Preserve upload, generation, flashcards, and saved-material behavior. In `src/design.css`, make reviewer upload and saved-library surfaces visually distinct with flat boundaries and a primary treatment only for the active upload or generate action.

- [ ] **Step 4: Verify these pages**

Run `npm run build` and `npm run test`.

**Expected:** no route or content behavior changes and build passes.

---

### Task 5: Responsive and Accessibility Pass

**Files:**
- Modify: `src/design.css`
- Modify: `src/components/Layout.tsx`
- Test: `tests/responsiveDesign.test.ts` (create if no suitable test harness is available)

- [ ] **Step 1: Add responsive CSS rules**

At `max-width: 680px`, ensure:
- workspace topbar decorative metadata is hidden
- dashboard and toolkit grids remain one column
- primary study action remains full-width
- practice controls stack rather than overflow
- mock-exam navigator scrolls horizontally inside the page
- reader remains a single-column document-first layout

- [ ] **Step 2: Preserve accessible interaction**

Keep existing focus rings, skip link, modal behavior, button labels, field associations, and live regions unchanged.

- [ ] **Step 3: Run final verification**

Run `npm run lint`, `npm run test`, and `npm run build`.

**Expected:** lint, tests, and production build pass.

