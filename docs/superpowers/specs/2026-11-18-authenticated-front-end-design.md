# Authenticated Front-End Design

## Intent

Make Pharmora AI's authenticated workspace feel calmer, more useful, and more specific to pharmacy study. The public site may retain its editorial clinical character; the workspace should prioritize the user's next action and avoid generic SaaS card chrome.

## Goals

- Make the dashboard answer "What should I study next?" immediately.
- Reduce repeated uppercase eyebrow labels and visually equal card treatments.
- Keep navigation, progress, actions, and feedback easy to distinguish.
- Improve mobile readability and touch usability without changing application behavior.
- Give Practice, Mock Exam, Side-by-Side Reader, Analytics, and Reviewers restrained page-specific hierarchy.
- Preserve existing React components, routing, data sources, theme behavior, and accessibility support.

## Non-goals

- No new routes, authentication behavior, study algorithms, or data model changes.
- No dependency additions.
- No wholesale recreation of the public landing page or auth screens.
- No changes to user-generated data or study calculations.

## Constraints

- Reuse existing CSS variables, UI components, icons, and responsive breakpoints.
- Preserve light and dark modes.
- Preserve keyboard focus, reduced-motion behavior, labels, and screen-reader announcements.
- Use existing page components rather than introducing a parallel design system.

## Approaches

1. **Full interface restyling:** replace major page layouts and component structures. Rejected as too risky for this pass because routing and workflows are already established.
2. **Dashboard-only redesign:** improve the primary workspace but leave inconsistent page patterns behind. Rejected because it would not complete the requested frontend pass.
3. **Selected restyling of shared chrome and major pages:** keep existing behavior and components, but consolidate hierarchy, spacing, and page-specific emphasis. Selected.

## Design

### Color

- Navy remains the structural and serious-information color.
- Blue identifies primary actions and navigation emphasis.
- Green identifies progress and successful recall.
- Purple identifies clinical or AI-assisted features.
- Warm neutral surfaces remain the workspace base.

### Typography

- Use `DM Sans` for interface copy.
- Use `DM Serif Display` only for major page headings and short decision-oriented statements.
- Convert decorative uppercase section labels to sentence case where the label is descriptive copy.
- Preserve compact uppercase treatment for navigation metadata and small status labels.

### Dashboard

- Present the next study action as the first prominent workspace element after the page heading.
- Show at most two future steps in a compact list.
- Move readiness, momentum, tools, and subject detail below the study plan.
- Remove duplicate or decorative section descriptions.
- Use flat sections or rules instead of identical elevated cards where the content is not independently actionable.

### Shared workspace

- On mobile, show the menu control, brand/page title, and essential page controls; remove decorative topbar metadata.
- Keep sidebar navigation, active states, theme controls, and profile actions intact.
- Preserve table overflow handling and add clear mobile labels for controls.

### Page-specific emphasis

- **Practice:** keep the study surface dominant and control groups compact.
- **Mock exam:** preserve a persistent, legible timer and high-focus question area.
- **Side-by-side reader:** keep document content dominant with restrained side-panel chrome.
- **Analytics:** reduce decorative cards and strengthen charts/comparison hierarchy.
- **Reviewers:** keep library content list/table-first with clear action placement.

### Acceptance

- The dashboard makes the next study action visible before secondary metrics.
- Repeated card chrome and decorative uppercase labels are materially reduced.
- The existing routes and actions still work.
- Mobile layouts avoid horizontal page overflow and maintain usable touch targets.
- Light/dark themes, keyboard focus, and reduced-motion behavior remain intact.

