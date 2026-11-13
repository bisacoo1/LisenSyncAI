# UI/UX Audit Report - LisenSync AI

> **Status update (2026-11-13):** Most critical items below are now resolved — ProgressBar uses correct CSS vars, Modal has a focus trap, Toasts have `role="alert"`/`aria-live`, sidebar has collapsed-state tooltips, skip link exists, toasts sit top-right (no auth-button conflict), practice tabs are scrollable, tables use `.table-wrapper`, and form controls have label associations. Remaining nice-to-haves: inline-style → utility-class migration, skeleton loaders in Reviewer tables, drag-to-reorder, command palette.

## Executive Summary

Your app has a **solid foundation** with a well-designed dark-mode design system, consistent component library, and good architecture. However, there are **critical accessibility gaps**, **mobile usability issues**, and **inconsistent patterns** that need addressing.

---

## 🎯 Critical Issues (Fix First)

### 1. Accessibility Violations

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| **ProgressBar uses `--ok`/`--warn` CSS vars that don't exist** | `src/components/ui/ProgressBar.tsx:36-42` | Broken visual states (success/warning variants render transparent) | Replace with `--success`/`--warning` |
| **Missing `aria-label` on icon-only buttons** | Multiple: Sidebar toggle, Mobile menu, Mock exam nav buttons | Screen readers can't identify purpose | Add `aria-label` to all icon-only buttons |
| **Modal focus trapping missing** | `src/components/ui/Modal.tsx` | Keyboard users can tab outside modal | Implement focus trap on open |
| **Missing `role="alert"` on toast/error messages** | Toast component, inline error banners | Screen readers won't announce dynamically | Add `role="alert"` + `aria-live="polite"` |
| **Radio inputs lack proper `<fieldset>`/`<legend>` grouping** | PracticePage MCQ, MockExamPage MCQ | Screen readers don't announce question context | Wrap in `<fieldset>` with `<legend>` |
| **Missing `htmlFor` on label-input pairs** | Multiple forms (Login, Register, Onboarding, etc.) | Clicking label doesn't focus input | Add `id` to inputs + `htmlFor` to labels |

### 2. Mobile UX Breakdowns

| Issue | Location | Impact |
|-------|----------|--------|
| **Sidebar collapses to icons-only on desktop but no tooltip** | `Sidebar.tsx`, `Layout.tsx` | Users don't know what icons mean when collapsed |
| **PracticePage tabs overflow on mobile** | `PracticePage.tsx:155` | Horizontal scroll or truncated labels |
| **MockExamPage question navigator unusable on mobile** | `MockExamPage.tsx:479-496` | 40px buttons too small, no scroll hint |
| **Table horizontal scroll has no indicator** | Dashboard, Analytics, Reviewer pages | Users don't know they can scroll |
| **Toast positioned bottom-right conflicts with auth-actions button** | `Layout.tsx:602-607` | Toasts cover sign-out button |

---

## 🔧 High-Priority Fixes

### 3. Design System Inconsistencies

```css
/* CURRENT - ProgressBar.tsx uses non-existent vars */
--ok (doesn't exist) → should be --success
--warn (doesn't exist) → should be --warning
```

```css
/* MISSING - Add to index.css :root */
--ok: var(--success);        /* Alias for ProgressBar compat */
--warn: var(--warning);      /* Alias for ProgressBar compat */
```

### 4. Inline Styles → CSS Classes Migration

**Problem**: ~40% of components use inline styles, making theming/maintenance hard.

**Files with most inline styles** (convert to utility classes):
- `DashboardPage.tsx` - Hero card, stats grid, progress bars
- `PracticePage.tsx` - All 4 mode renderers
- `MockExamPage.tsx` - Timer card, question cards, navigator
- `ReviewerPage.tsx` - Upload area, generate buttons
- `AnalyticsPage.tsx` - Stat cards, tables

**New utility classes to add to `index.css`:**
```css
/* Card variants */
.card-hero { ... }           /* Gradient bg, elevated */
.card-stat { ... }           /* Icon + value + label */
.card-action { ... }         /* Full-width button stack */
.card-table { ... }          /* Table wrapper with overflow */

/* Layout */
.page-header { ... }         /* Already exists - use it! */
.section-header { ... }      /* Title + subtitle + action */
.stat-grid { ... }           /* Responsive grid for stat cards */
```

### 5. Confusing User Flows

| Flow | Problem | Fix |
|------|---------|-----|
| **Reviewer → Generate → Practice redirect** | `ReviewerPage.tsx:118` uses `navigate()` with query params, but PracticePage reads from `searchParams` only on mount | PracticePage should `useEffect` on `searchParams` changes |
| **Flashcard detail modal** | Clicking flashcard in Reviewer opens modal but doesn't navigate to Practice | Add "Practice this subject" button in modal |
| **Mock exam submit confirmation** | Two-step: Submit button → Modal → Confirm | Good pattern, but modal lacks keyboard shortcut (Enter to confirm) |
| **Onboarding after register** | Register saves profile but doesn't auto-redirect if session exists | Already handled at line 37, verify works |

---

## 📱 Medium-Priority Improvements

### 6. Component Polish

**Button Loading States**: Inconsistent - some use `loading` prop, some use `disabled` + text change. Standardize on `loading` prop.

**Empty States**: Good component exists but inconsistent usage. Some pages show raw "No data" text.

**Skeleton Loaders**: Used in Dashboard/Practice but not in Analytics/Reviewer tables.

**Tooltip System**: Missing entirely. Needed for:
- Collapsed sidebar icons
- Badge variants (what does "Needs remediation" mean?)
- Table column headers (abbreviated subjects)

### 7. Visual Hierarchy Issues

**Dashboard Page**:
- Hero card mixes gradient bg + elevated shadow = visual noise
- Quick Actions card should be more prominent (primary CTA)
- "Focus Areas" and "Per-Subject Performance" same visual weight but different importance

**Practice Page**:
- Mode tabs + Subject select + Reload button = 3 controls competing
- Flashcard mode: "Show Prompt/Reveal Answer" button text confusing (should be "Flip Card")
- Diagnosis mode: Input placeholder says "exact concept/principle/law/formula" - too long

**Mock Exam Page**:
- Timer card in header good, but progress bar below it redundant
- Question navigator: answered=green, current=primary, unanswered=border - good! But needs legend

### 8. Dark Mode Only (For Now)

Light mode CSS exists but `.dark` class forced on `:root`. If you want light mode support:
- Remove forced dark mode
- Add theme toggle in sidebar
- Persist preference in localStorage
- Update all hardcoded colors to use CSS variables

---

## ✨ Low-Priority Enhancements

### 9. Delightful Details

| Feature | Effort | Value |
|---------|--------|-------|
| **Command Palette (Cmd+K)** | Medium | Power user navigation |
| **Keyboard shortcuts help (?)** | Low | Discoverability |
| **Drag-to-reorder sequence items** | Medium | Better than up/down buttons |
| **Flashcard swipe gestures (mobile)** | Medium | Native feel |
| **Mock exam "mark for review" flag** | Low | Exam strategy |
| **Confetti on mock exam pass** | Low | Celebration |
| **Progress ring on dashboard hero** | Low | Visual impact |
| **Animated number counting** | Low | Polish |

---

## 🛠 Implementation Priority Order

### Phase 1: Critical Fixes (Do Now)
1. Fix ProgressBar CSS variable bug
2. Add ARIA labels to all icon-only buttons
3. Add focus trap to Modal
4. Add `htmlFor`/`id` to all form labels
5. Wrap radio groups in `<fieldset>`
6. Fix toast/sign-out button overlap

### Phase 2: Mobile & Accessibility (Week 1)
7. Add sidebar collapsed tooltips
8. Make PracticePage tabs responsive (scrollable or dropdown)
9. Fix MockExam navigator mobile (larger touch targets, horizontal scroll hint)
10. Add table scroll indicators
11. Add `role="alert"` to error toasts/banners

### Phase 3: Design System Cleanup (Week 2)
12. Create utility CSS classes for common patterns
13. Migrate inline styles to classes (start with Dashboard, Practice)
14. Standardize Button loading states
15. Consistent EmptyState usage
16. Add Skeleton loaders to all async tables

### Phase 4: Flow Improvements (Week 3)
17. Fix Reviewer→Practice redirect with query params
18. Add "Practice this subject" to flashcard modal
19. Add Enter key to submit confirmation modal
20. Verify register→dashboard flow

### Phase 5: Polish & Delight (Ongoing)
21. Tooltip system
22. Command palette
23. Keyboard shortcuts
24. Drag-to-reorder sequence
25. Mobile swipe gestures

---

## 📁 Files to Modify (Priority Order)

| File | Changes Needed |
|------|----------------|
| `src/components/ui/ProgressBar.tsx` | Fix CSS var names (CRITICAL) |
| `src/components/ui/Modal.tsx` | Add focus trap |
| `src/components/ui/Toast.tsx` | Add `role="alert"` |
| `src/components/Sidebar.tsx` | Add tooltips for collapsed state |
| `src/components/Layout.tsx` | Fix toast/button z-index conflict |
| `src/index.css` | Add utility classes, fix CSS vars |
| `src/pages/DashboardPage.tsx` | Migrate inline styles, visual hierarchy |
| `src/pages/PracticePage.tsx` | Accessibility (fieldset), mobile tabs, button labels |
| `src/pages/MockExamPage.tsx` | Mobile navigator, radio fieldset |
| `src/pages/ReviewerPage.tsx` | Redirect flow, modal action |
| `src/pages/AnalyticsPage.tsx` | Skeleton loaders, consistent empty states |
| `src/pages/LoginPage.tsx` | Label `htmlFor` |
| `src/pages/RegisterPage.tsx` | Label `htmlFor` |
| `src/pages/OnboardingPage.tsx` | Label `htmlFor` |

---

## 🧪 Testing Checklist

After fixes, verify:
- [ ] Tab through entire app - no focus traps, visible focus rings
- [ ] Screen reader (NVDA/VoiceOver) - all content announced
- [ ] Mobile (375px) - all pages usable, no horizontal overflow
- [ ] Tablet (768px) - sidebar toggle works, tables scrollable
- [ ] Dark/Light mode toggle (if enabled) - no hardcoded colors
- [ ] Keyboard-only mock exam - can navigate, answer, submit
- [ ] Form validation - errors announced, focus moves to first error