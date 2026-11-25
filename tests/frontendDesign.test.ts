import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectFile = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('authenticated frontend hierarchy', () => {
  it('places the study summary cards between the welcome header and roadmap', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    const headerIndex = dashboard.indexOf('</header>')
    const statsIndex = dashboard.indexOf('className="dashboard-stats-strip')
    const roadmapIndex = dashboard.indexOf('className="dashboard-actions-grid"')

    expect(statsIndex).toBeGreaterThan(headerIndex)
    expect(statsIndex).toBeLessThan(roadmapIndex)
  })

  it('uses the locally bundled Figtree font throughout the system', () => {
    const entry = projectFile('src/main.tsx')
    const styles = projectFile('src/index.css')

    expect(entry).toContain("@fontsource-variable/figtree/wght.css")
    expect(styles).toMatch(/--font-sans:\s*'Figtree Variable'/)
    expect(styles).toMatch(/--font-display:\s*'Figtree Variable'/)
  })

  it('shows study stats before the roadmap and quick actions before detailed module progress', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    const css = projectFile('src/design.css')

    const statsIndex = dashboard.indexOf('dashboard-stats-strip')
    const studyPlanIndex = dashboard.indexOf('study-plan-section')
    const readinessIndex = dashboard.indexOf('dashboard-feature-grid')

    expect(statsIndex).toBeGreaterThan(dashboard.indexOf('</header>'))
    expect(statsIndex).toBeLessThan(studyPlanIndex)
    expect(statsIndex).toBeLessThan(dashboard.indexOf('course-trends-panel'))
    expect(statsIndex).toBeLessThan(readinessIndex)
    expect(studyPlanIndex).toBeGreaterThan(0)
    expect(readinessIndex).toBeGreaterThan(0)
    expect(dashboard).not.toContain('momentum-card')
    expect(dashboard).toContain('className="course-trends-panel" aria-labelledby="course-analytics-title"')
    expect(dashboard).not.toContain('course-overview-copy')
    expect(dashboard).not.toContain('View analytics')
    expect(dashboard).not.toContain('Progress across your classes.')
    expect(dashboard).toContain('userSubjects.map(subject => ({')
    expect(dashboard).toContain('getSubjectDailyTrend(attempts, subject.name)')
    expect(dashboard).toContain('<h2 id="course-analytics-title">Course subject trends</h2>')
    expect(dashboard).toContain('className="course-analytics-heading dashboard-section-heading"')
    expect(dashboard).toContain('>Last 14 days</span>')
    expect(dashboard).not.toContain('course-trend-subject-picker')
    expect(dashboard).toContain('<SubjectDailyTrendChart trends={courseSubjectTrends} />')
    expect(dashboard).toContain('<PracticeDaysList trends={courseSubjectTrends} />')
    expect(dashboard).toContain('summarizePracticeDays(trends)')
    expect(dashboard).toContain('<details className="course-practice-days">')
    expect(dashboard).toContain('<summary className="course-practice-days-heading">')
    expect(dashboard).toContain('No practice')
    expect(dashboard).toContain('<time dateTime={day.date}>')
    expect(dashboard).toContain('path: smoothTrendPath(practicedPoints, pad.top, pad.top + innerHeight)')
    expect(dashboard).toContain('day.percent === null ? []')
    expect(dashboard).toContain('className="course-trend-tooltip"')
    expect(dashboard).toContain('tabIndex={0}')
    expect(dashboard).toContain('Focus or hover on a point for the exact accuracy and question count.')
    expect(dashboard).not.toContain('{`${day.percent}%`}')
    expect(css).toContain('.course-trend-chart-scroll')
    expect(css).toContain('.course-trend-point:hover .course-trend-tooltip')
    expect(css).toContain('.course-trend-point:focus .course-trend-tooltip')
    expect(css).toContain('.course-trend-legend')
    expect(css).toContain('.course-practice-days-list')
    expect(css).toMatch(/\.course-trends-panel\s*\{[^}]*display:\s*block;/s)
    expect(dashboard).not.toContain('> Course overview')
    expect(dashboard).toContain('className="dashboard-actions-grid"')
    expect(dashboard).not.toContain('dashboard-stat-label">Study level')
    expect(dashboard).toContain('className="dashboard-stat dashboard-stat--daily-goal"')
    expect(dashboard).toContain('<CircularProgress')
    expect(dashboard).not.toContain('dashboard-stat-progress')
    expect(dashboard).toContain('dashboard-stat--accuracy')
    expect(dashboard).toContain('dashboard-stat-label">Overall accuracy')
    expect(dashboard).toContain('value={overall} suffix="%"')
    expect(dashboard).toContain('value={attempts.length} duration={1100} delay={180}')
    expect(dashboard).toContain('questions answered')
    expect(dashboard).toContain('Loading quiz results…')
    expect(dashboard).not.toContain('Cards to study')
    expect(dashboard).toContain("action: dueCards > 0 ? 'Review cards' : 'All caught up'")
    expect(dashboard).not.toContain('showHeaderPrimaryAction')
    expect(dashboard).toContain('className="dashboard-actions-grid"')
    expect(dashboard.indexOf('dashboard-actions-grid')).toBeLessThan(dashboard.indexOf('subjects-title'))
    expect(css).toContain('.dashboard-page .dashboard-stats-strip')
    expect(css).toMatch(/\.dashboard-page \.dashboard-stats-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-stats-strip\s*\{[^}]*gap:\s*0;/s)
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.dashboard-page \.dashboard-stats-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s)
    expect(css).not.toContain('.dashboard-page .dashboard-stat:last-child { grid-column: 1 / -1; }')
    expect(css).toMatch(/\.dashboard-page \.dashboard-stat\s*\{[^}]*background:\s*transparent/)
    expect(css).toMatch(/\.dashboard-page \.dashboard-stat\s*\{[^}]*border:\s*0;/)
    expect(css).toMatch(/\.dashboard-page \.dashboard-stat\s*\{[^}]*box-shadow:\s*none;/)
    expect(css).toContain('.dashboard-page .dashboard-stat + .dashboard-stat::before')
    expect(css).not.toContain('dashboard-stat--link')
    expect(css).toMatch(/\.dashboard-page \.dashboard-actions-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-actions-grid\s*\{[^}]*align-items:\s*stretch;[^}]*gap:\s*16px;/s)
    expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*?\.dashboard-page \.dashboard-actions-grid \{ gap: 12px; \}/s)
    expect(css).toMatch(/:root \.dashboard-page \.study-plan-step\s*\{[^}]*display:\s*flex;/s)
    expect(css).toMatch(/\.dashboard-page \.study-plan-step-copy strong\s*\{[^}]*font-size:\s*15px;/s)
    expect(css).toMatch(/\.dashboard-page \.study-plan-step-copy small\s*\{[^}]*font-size:\s*12px;/s)
    expect(css).toMatch(/\.dashboard-page \.study-plan-step-action\s*\{[^}]*font-size:\s*12px;/s)
    expect(css).toMatch(/@media \(max-width: 380px\)[\s\S]*?\.dashboard-page \.dashboard-stat-content > small \{ font-size: 12px; \}/s)
    expect(css).toMatch(/\.dashboard-page \.panel-title h3\s*\{[^}]*font-size:\s*16px;/s)
    expect(css).toMatch(/\.dashboard-page \.panel-title p\s*\{[^}]*font-size:\s*12px;/s)
    expect(dashboard).toMatch(/className="readiness-orbit"[\s\S]*?role="img"[\s\S]*?aria-label=/)
    expect(css).toMatch(/\.study-plan-step[^{]*\{[^}]*box-shadow:/s)
  })

  it('shows study level in the top-right account menu', () => {
    const layout = projectFile('src/components/Layout.tsx')
    const css = projectFile('src/design.css')
    const sidebar = projectFile('src/components/Sidebar.tsx')

    expect(layout).toContain('className="workspace-account-trigger"')
    expect(layout).not.toContain('className="workspace-program"')
    expect(layout).toContain('aria-expanded={accountMenuOpen}')
    expect(layout).toContain('className="workspace-account-panel"')
    expect(layout).toContain('className="workspace-account-signout"')
    expect(layout).toContain('Study level')
    expect(layout).toContain('getLevelProgress(accountXp)')
    expect(layout).toContain('accountLevelProgress.xpRemaining} XP to level up')
    expect(layout).toContain('className="workspace-account-xp-track"')
    expect(layout).toContain('accountLevelProgress.progressPercent')
    expect(layout).toContain("navigate('/login')")
    expect(sidebar).not.toContain('sidebar-profile-name')
    expect(sidebar).not.toContain('aria-label="Sign out"')
    expect(css).toContain('.workspace-account-panel[hidden] { display: none; }')
    expect(css).toContain('.workspace-account-xp-track > span')
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.workspace-account-trigger-name \{ display: none; \}/s)
  })

  it('hides decorative mobile workspace metadata at the small-screen breakpoint', () => {
    const css = projectFile('src/design.css')
    const mobileRules = css.slice(css.indexOf('@media (max-width: 680px)'))

    expect(mobileRules).toMatch(/\.workspace-topbar-right\s*\{[^}]*display:\s*none/s)
  })

  it('keeps practice and mock exam work surfaces in focused layouts', () => {
    const css = projectFile('src/design.css')

    expect(css).toMatch(/\.practice-question-card\s*\{/)
    expect(css).toMatch(/\.practice-controls-card\s*\{/)
    expect(css).toMatch(/\.mock-exam|\.timer\s*\{/)
  })
  it('keeps all study plan actions available on mobile and links drills to their subject', () => {
    const css = projectFile('src/design.css')
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    expect(css).toMatch(/\.study-plan-list li:not\(:first-child\)\s*\{\s*display:\s*block/)
    expect(dashboard).toContain('/practice?subject=${encodeURIComponent(s.subject)}')
  })

  it('connects roadmap steps and locks practice while flashcards are due', () => {
    const css = projectFile('src/design.css')
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    const practice = projectFile('src/pages/PracticePage.tsx')

    expect(dashboard).toContain('className="dashboard-roadmap-connector"')
    expect(dashboard).toContain('data-step-kind={step.kind}')
    expect(dashboard).toContain('strokeDasharray="4 5"')
    expect(css).toMatch(/\.dashboard-roadmap-connector\s*\{[^}]*height:\s*24px;/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-actions-grid > \.study-plan-section\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list li\[data-step-kind="baseline"\],[\s\S]*?flex:\s*0 0 auto;/)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list li\[data-step-kind="baseline"\] \.study-plan-step\s*\{[^}]*min-height:\s*168px;[^}]*height:\s*auto;/s)
    expect(dashboard).not.toContain('dashboard-roadmap-feature-icon')
    expect(css).toMatch(/\.dashboard-roadmap-list \.study-plan-step\[aria-disabled="true"\]\s*\{[^}]*background:\s*var\(--panel-2\)/s)
    expect(dashboard).toContain('locked: dueCards > 0')
    expect(dashboard).toContain('Review all ${dueCards} due flashcards first to unlock practice.')
    expect(dashboard).toContain('className="study-plan-step" aria-disabled="true"')
    expect(practice).toContain("reviewGate.mode !== mode")
    expect(practice).toContain('Review due flashcards first')
  })

  it('explains which prerequisite must be finished before a locked roadmap step', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')

    expect(dashboard).toContain('Finish Step ${blockingStepIndex + 1} first')
    expect(dashboard).toContain('Complete the prerequisite first')
    expect(dashboard).toContain('{actionLabel}')
  })

  it('uses the roadmap for course weak spots and AI focus', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    const css = projectFile('src/design.css')

    expect(dashboard).toContain('const focusSubject = selectDailyRoadmapSubject(')
    expect(dashboard).toContain('await generateRoadmapFocus({')
    expect(dashboard).toContain('Choose focus with AI')
    expect(dashboard).toContain('onClick={makeAiStudyPlan}')
    expect(dashboard).toContain('`Practice ${focusSubject.subject} weak spots`')
    expect(dashboard).toMatch(/\{!isCourse && \(\s*<Reveal as="section" className="dashboard-section" aria-labelledby="subjects-title">/)
    expect(dashboard).not.toContain("isCourse ? 'Practice weak spots' : 'Module progress'")
    expect(css).not.toContain('.dashboard-bottom-grid--single')
  })

  it('initializes the workspace theme from the stored preference', () => {
    const layout = projectFile('src/components/Layout.tsx')
    expect(layout.indexOf("localStorage.getItem('workspace-theme')")).toBeLessThan(layout.indexOf("localStorage.setItem('workspace-theme'"))
    expect(layout).toContain("if (stored === 'dark' || stored === 'light') return stored === 'dark'")
    expect(layout).toContain("return true")
  })

  it('applies the dashboard navy theme to all dark workspace routes by default', () => {
    const entry = projectFile('src/main.tsx')
    const layout = projectFile('src/components/Layout.tsx')
    const styles = projectFile('src/design.css')
    expect(entry).toContain("localStorage.getItem('workspace-theme')")
    expect(entry).toContain("theme === 'light' ? 'light' : 'dark'")
    expect(layout).toContain("isDark ? ' app-shell--navy' : ''")
    expect(styles).toContain(':root.dark .app-shell.app-shell--navy')
    expect(styles).toContain('--workspace-canvas: #0a162b')
  })

})

describe('dashboard failure handling', () => {
  it('shows a retry instead of presenting failed queries as empty progress', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    expect(dashboard).toContain('if (error) throw error')
    expect(dashboard).toContain('if (loadError) return')
    expect(dashboard).toContain('setReloadCount(value => value + 1)')
    expect(dashboard).toContain('return () => { active = false }')
  })
})

describe('consistent dashboard surfaces', () => {
  it('uses shared theme surfaces for the dashboard cards without overriding semantic status colors', () => {
    const css = projectFile('src/design.css')
    const palette = css.slice(css.indexOf('/* Consistent workspace surfaces:'))
    expect(palette).toContain(':root .dashboard-page .readiness-panel,')
    expect(palette).toContain(':root .dashboard-page .toolkit-card:nth-child(2),')
    expect(palette).toContain('background: var(--panel);')
    expect(palette).toContain('border: 1px solid var(--border);')
    expect(palette).toContain('background: var(--primary);')
    expect(palette).not.toContain('.ui-badge')
  })

  it('keeps the dashboard hierarchy readable and preserves the yellow active-step indicator', () => {
    const dashboard = projectFile('src/pages/DashboardPage.tsx')
    const css = projectFile('src/design.css')

    expect(dashboard).toContain('<h1>Study overview</h1>')
    expect(css).toMatch(/\.dashboard-page \.dashboard-stat-label\s*\{[^}]*font-size:\s*14px;/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list li\[aria-current="step"\] \.study-plan-step\s*\{[^}]*background:\s*var\(--roadmap-highlight\);/s)
    expect(css).toMatch(/:root \.app-shell\.app-shell--dashboard \.countdown-panel\s*\{[^}]*background:\s*var\(--panel\);/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list \.study-plan-step\s*\{[^}]*box-shadow:\s*0 3px 0/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list \.study-plan-step\[aria-disabled="true"\]\s*\{[^}]*box-shadow:\s*0 3px 0/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list a\.study-plan-step:hover\s*\{[^}]*transform:\s*translateY\(-2px\)/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list \.study-plan-step-action\s*\{[^}]*box-shadow:\s*0 2px 0 var\(--primary-border\)/s)
    expect(css).toMatch(/\.dashboard-page \.dashboard-roadmap-list \.study-plan-step\[aria-disabled="true"\] \.study-plan-step-action\s*\{[^}]*box-shadow:\s*0 2px 0 var\(--border-strong\)/s)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.dashboard-page \.dashboard-roadmap-list \.study-plan-step \{\s*transition:\s*none;\s*\}\s*\.dashboard-page \.dashboard-roadmap-list \.study-plan-step:hover \{\s*transform:\s*none;\s*\}\s*\.dashboard-page \.dashboard-roadmap-list \.study-plan-step-action \{\s*transition:\s*none;\s*\}\s*\}/s)
  })
})

describe('consistent page heading sizes', () => {
  it('uses the dashboard heading scale for Analytics at desktop and mobile widths', () => {
    const analytics = projectFile('src/pages/AnalyticsPage.tsx')
    const css = projectFile('src/design.css')
    expect(analytics).toContain('className="container workspace-page analytics-page"')
    expect(css).toMatch(/\.analytics-page \.workspace-page-header h1\s*\{\s*font-size:\s*clamp\(30px,\s*3vw,\s*42px\);/s)
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.analytics-page \.workspace-page-header h1\s*\{\s*font-size:\s*clamp\(30px,\s*8vw,\s*38px\);/s)
  })
})

describe('mint workspace theme', () => {
  it('provides light and dark workspace palettes with accessible active navigation', () => {
    const theme = projectFile('src/index.css')
    const styles = projectFile('src/design.css')
    expect(theme).toContain(':root .app-shell,')
    expect(theme).toContain(':root.dark .app-shell,')
    expect(theme).toContain(':root:not(.light):not(.dark) .app-shell')
    expect(theme).toContain('--workspace-nav-active-text: #ffffff')
    expect(theme).toContain('--workspace-nav-active-text: #0d3027')
    expect(styles).toContain('outline: 3px solid var(--primary)')
    expect(styles).not.toContain('--bg: #f3f7f5')
  })
})

describe('accessible route and study controls', () => {
  it('moves focus to a named main landmark after route changes', () => {
    const app = projectFile('src/App.tsx')
    const layout = projectFile('src/components/Layout.tsx')
    expect(app).toContain("document.querySelector<HTMLElement>('[data-route-main]')?.focus({ preventScroll: true })")
    expect(layout).toContain('aria-label={pageName} data-route-main')
  })

  it('uses native radio inputs for the mutually exclusive study track', () => {
    const selector = projectFile('src/components/StudyTrackSelector.tsx')
    const reader = projectFile('src/pages/SideBySideReader.tsx')
    expect(selector).toContain('<fieldset className="study-track-selector">')
    expect(selector).toContain('type="radio"')
    expect(reader).toContain('role="group" aria-label="Reader view"')
  })

  it('keeps practice answer feedback inline without a duplicate result toast', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const handlers = practice.slice(practice.indexOf('async function submitMcq()'), practice.indexOf('function questionContext'))
    expect(handlers).toContain('setFeedback')
    expect(handlers).not.toContain('addToast')
  })

  it('guides learners to a reviewer and only shows Lilo during an active session', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const styles = projectFile('src/design.css')

    expect(practice).toContain('Choose a reviewer to start practicing')
    expect(practice).toContain('practice-start-steps')
    expect(practice).toContain('selectedModeDescription')
    expect(practice).toContain('const showCompanion = !loading && !empty && !done && Boolean(current || currentCard)')
    expect(practice).toContain('{showCompanion && <aside')
    expect(styles).toContain('.practice-session-panel--solo .practice-session-content')
    expect(styles).toContain('@media (max-width: 680px)')
    expect(styles).toContain('.practice-start-card')
  })

  it('uses a mute toggle for Lilo speech and suppresses speech while muted', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const speechPanel = projectFile('src/components/LiloSpeechPanel.tsx')
    const icons = projectFile('src/components/ui/Icon.tsx')

    expect(practice).toContain('const [liloMuted, setLiloMuted] = useState(false)')
    expect(practice).toContain('muted={liloMuted}')
    expect(speechPanel).toContain("if (!cleanMessage || mutedRef.current) return")
    expect(speechPanel).toContain("variant={muted ? 'danger' : 'outline'}")
    expect(speechPanel).toContain("aria-label={muted ? 'Unmute Lilo' : 'Mute Lilo'}")
    expect(speechPanel).toContain("{muted ? 'Unmute' : 'Mute'}")
    expect(speechPanel).not.toContain('Listen with Lilo')
    expect(icons).toContain("'volume-x': VolumeX")
  })

  it('anchors Lilo in a responsive companion card', () => {
    const styles = projectFile('src/design.css')
    const speechPanel = projectFile('src/components/LiloSpeechPanel.tsx')

    expect(styles).toMatch(/\.practice-companion\s*\{[^}]*box-sizing:\s*border-box;[^}]*padding:\s*12px;[^}]*border:\s*1px solid var\(--border\);[^}]*background:\s*var\(--panel\);/)
    expect(styles).toMatch(/@media \(min-width: 1360px\)\s*\{\s*\.practice-companion \{[^}]*width:\s*216px;/)
    expect(speechPanel).toContain("isSpeaking ? ' is-speaking' : ''")
    expect(speechPanel).toContain("motionEnabled ? ' is-motion-enabled' : ''")
    expect(styles).toMatch(/\.lilo-cage::before, \.lilo-cage::after[^}]*repeating-linear-gradient\(90deg/)
    expect(styles).toContain('.lilo-cage.is-speaking::before')
    expect(styles).toContain('.lilo-cage.is-speaking::after')
  })

  it('positions the Flashcards prompt card lower beneath its subject badge', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const styles = projectFile('src/design.css')
    const flashcards = practice.slice(
      practice.indexOf('{/* Flashcards Mode */}'),
      practice.indexOf('{/* MCQ Mode */}'),
    )

    expect(flashcards).toContain('className="practice-question-meta"')
    expect(flashcards).toContain('<Badge variant="primary" size="md">{displaySubject}</Badge>')
    expect(flashcards).not.toContain('practice-question-meta--flashcard')
    expect(styles).toMatch(/\.practice-question-meta\s*\{[^}]*margin-bottom:\s*24px;/)
    expect(styles).toMatch(/\.practice-flashcard\s*\{[^}]*margin-top:\s*32px;/)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.practice-flashcard \{[^}]*margin-top: 26px;/)
    expect(styles).toMatch(/\.practice-question-meta \{ justify-content: flex-start; margin-bottom: 18px; \}/)
  })

  it('labels the practice page as Study mode without the session eyebrow', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const layout = projectFile('src/components/Layout.tsx')
    const sidebar = projectFile('src/components/Sidebar.tsx')

    expect(practice).toContain('<h1>Study mode</h1>')
    expect(practice).not.toContain('YOUR NEXT STUDY SESSION')
    expect(practice).toContain('ariaLabel="Study mode"')
    expect(layout).toContain("'/practice': 'Study mode'")
    expect(sidebar).not.toContain("label: 'Study mode'")
  })

  it('separates study decks from subject folders and moves decks through a modal', () => {
    const reviewers = projectFile('src/pages/MyReviewersPage.tsx')

    expect(reviewers).toContain('className="reviewer-library-entry-card"')
    expect(reviewers).toContain('aria-label="Open Study Decks"')
    expect(reviewers).toContain('aria-label="Open Subjects"')
    expect(reviewers).toContain("onClick={() => showLibraryView('decks')}")
    expect(reviewers).toContain("onClick={() => showLibraryView('subjects')}")
    expect(reviewers).toContain('() => reviewers.filter(entry => !entry.material.subject_folder_id)')
    expect(reviewers).toContain('renderReviewerDecks(studyDecks)')
    expect(reviewers).toContain('visibleFolders.map(folder =>')
    expect(reviewers).toContain('onClick={() => openMoveReviewer(entry)}')
    expect(reviewers).toContain('title={moveTarget ? `Move ${moveTarget.material.title}` : \'Move study deck\'}')
    expect(reviewers).toContain('Move deck')
    expect(reviewers).not.toContain('Move to subject folder…')
  })

  it('uses labeled icon-only actions for study decks', () => {
    const reviewers = projectFile('src/pages/MyReviewersPage.tsx')
    const icons = projectFile('src/components/ui/Icon.tsx')
    const editButtonLabel = reviewers.indexOf('aria-label={`Edit study set ${entry.material.title}`}')
    const editButtonStart = reviewers.lastIndexOf('<Button', editButtonLabel)
    const editButtonEnd = reviewers.indexOf('/>', editButtonLabel) + 2

    expect(reviewers).toContain('aria-label={`Choose study mode for ${entry.material.title}`}')
    expect(reviewers).toContain('aria-label={`Share reviewer ${entry.material.title}`}')
    expect(reviewers).toContain('leftIcon="folder-input"')
    expect(reviewers).toContain('aria-label={`Edit study set ${entry.material.title}`}')
    expect(reviewers).toContain('leftIcon="edit"')
    expect(reviewers.slice(editButtonStart, editButtonEnd)).toContain('variant="outline"')
    expect(reviewers).toContain('aria-label={`Delete ${entry.material.title}`}')
    expect(reviewers).not.toContain('navigate(`/side-by-side/${entry.material.id}`)')
    expect(icons).toContain("'folder-input': FolderInput")
  })

  it('supports editing generated content with optional hints and resets its progress', () => {
    const editor = projectFile('src/components/StudyDeckEditorModal.tsx')
    const practice = projectFile('src/pages/PracticePage.tsx')
    const migration = projectFile('supabase/migrations/202611240003_review_material_management.sql')

    expect(editor).toContain('validateGeneratedPracticeItems')
    expect(editor).toContain("p_hint: draft.hint.trim() || null")
    expect(editor).toContain('ease_factor: 2.5')
    expect(editor).toContain("supabase.rpc('update_review_practice_item'")
    expect(migration).toContain('delete from public.attempts')
    expect(migration).toContain('public.delete_review_material')
    expect(migration).toContain('grant execute on function public.delete_review_material(uuid) to authenticated')
    expect(practice).toContain('<SavedStudyHint hint={current.hint} />')
    expect(practice).toContain('<SavedStudyHint hint={currentCard.hint} />')
  })

  it('guides learners without study decks to upload materials', () => {
    const reviewers = projectFile('src/pages/MyReviewersPage.tsx')

    expect(reviewers).toContain("'No study decks yet'")
    expect(reviewers).toContain("'Upload study materials to create your first deck.'")
    expect(reviewers).toContain("label: 'Upload materials', variant: 'primary', onClick: () => navigate('/reviewer?tab=upload')")
  })

  it('uses explicit subject-folder actions and keeps deletion undoable', () => {
    const reviewers = projectFile('src/pages/MyReviewersPage.tsx')
    const migration = projectFile('supabase/migrations/202611230002_delete_subject_folder_contents.sql')

    expect(reviewers).toContain('aria-label={`Edit subject name ${folder.subject}`}')
    expect(reviewers).toContain('aria-label={`Delete subject ${folder.subject}`}')
    expect(reviewers).toContain('function saveSubjectFolderName()')
    expect(reviewers).toContain(".from('user_subjects')")
    expect(reviewers).toContain('.update({ name })')
    expect(reviewers).toContain('entry.material.subject_folder_id === updatedSubject.id')
    expect(reviewers).not.toContain('onDoubleClick=')
    expect(reviewers).not.toContain('folderLongPressTimer')
    expect(reviewers).toContain("supabase.rpc('delete_subject_folder_contents'")
    expect(reviewers).toContain('const SUBJECT_FOLDER_UNDO_WINDOW_MS = 8_000')
    expect(reviewers).toContain('function confirmFolderRemoval()')
    expect(reviewers).toContain('open={Boolean(removeFolderTarget)}')
    expect(reviewers).toContain('onClick={confirmFolderRemoval}')
    expect(reviewers).toContain('You’ll have 8 seconds to undo after confirming.')
    expect(reviewers).toContain("title: 'Subject deleted'")
    expect(reviewers).toContain("action: { label: 'Undo'")
    expect(reviewers).toContain('duration: SUBJECT_FOLDER_UNDO_WINDOW_MS')
    expect(reviewers).toContain("placement: 'center'")
    expect(migration).toContain('delete from public.flashcards')
    expect(migration).toContain('delete from public.practice_items')
    expect(migration).toContain('delete from public.review_materials')
    expect(migration).toContain('delete from public.user_subjects')
  })

  it('lets learners undo a study-deck deletion before the RPC runs', () => {
    const reviewers = projectFile('src/pages/MyReviewersPage.tsx')

    expect(reviewers).toContain('const REVIEWER_UNDO_WINDOW_MS = 8_000')
    expect(reviewers).toContain('function queueReviewerDeletion(entry: ReviewerEntry)')
    expect(reviewers).toContain('action: { label: \'Undo\', onClick: () => undoReviewerDeletion(entry) }')
    expect(reviewers).toContain('void permanentlyDeleteReviewer(entry)')
    expect(reviewers).toContain('setReviewerDeletionPending(materialId, false, true)')
    expect(reviewers).toContain('reviewers.filter(entry => !pendingReviewerIds.has(entry.material.id))')
    expect(reviewers).toContain('Use Undo in the toast within 8 seconds to keep this deck.')
  })

  it('keeps the AI reader accessible from reviewers rather than the sidebar', () => {
    const sidebar = projectFile('src/components/Sidebar.tsx')
    const reviewers = projectFile('src/pages/MyReviewersPage.tsx')

    expect(sidebar).not.toContain("label: 'Side by side'")
    expect(sidebar).toContain("location.pathname.startsWith('/side-by-side')")
    expect(reviewers.match(/Read with AI/g)).toHaveLength(1)
    expect(reviewers).toContain('navigate(`/side-by-side/${selectedReviewer.material.id}`)')
  })

  it('shows the selected reviewer folder while keeping content queries on the material subject', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const reviewers = projectFile('src/pages/MyReviewersPage.tsx')

    expect(reviewers).toContain('&folder=${encodeURIComponent(selectedReviewer.folderName)}')
    expect(practice).toContain("searchParams.get('folder')")
    expect(practice).toContain('const displaySubject = folderSubject || subject')
    expect(practice).toContain('{displaySubject} · Multiple choice')
    expect(practice).toContain(".eq('subject', subject)")
  })

  it('keeps the selected study mode while browsing reviewers and opens matching content directly', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const reviewers = projectFile('src/pages/MyReviewersPage.tsx')

    expect(practice).toContain('navigate(`/reviewers?from=study&mode=${encodeURIComponent(mode)}`)')
    expect(reviewers).toContain("searchParams.get('from') === 'study'")
    expect(reviewers).toContain('const params = studyBrowseParams()')
    expect(reviewers).toContain('selectedReviewer.modeCounts[requestedStudyMode] || 0')
    expect(reviewers).toContain('navigate(`/practice?${params.toString()}`, { replace: true })')
    expect(reviewers).toContain('Choose another available set or go back to change your mode.')
  })

  it('displays enumeration answers as a list and prompts for one item per line', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const enumeration = practice.slice(practice.indexOf('{/* Enumeration Mode'), practice.indexOf('{!loading && !empty && !done && !feedback'))

    expect(practice).toContain('className="practice-enumeration-inputs"')
    expect(enumeration).toContain('className="practice-prompt practice-prompt--enumeration"')
    expect(enumeration).toContain('className="practice-content-block practice-content-block--enumeration-prompt"')
    expect(enumeration).not.toContain('practice-field-label">Prompt</div>')
    expect(practice).toContain('value={diagInput.split(\'\\n\')[answerIndex] || \'\'}')
    expect(practice).toContain('placeholder={`Answer ${answerIndex + 1}`}')
    expect(practice).toContain('Enter one answer in each box; order doesn’t matter.')
    expect(practice).toContain('Array.from({ length: requestedEnumerationCount }')
    expect(practice).toContain('Regenerate the enumeration study set to answer it.')
    expect(practice).not.toContain('placeholder="Enter one item per line..."')
    expect(practice).toContain('className="practice-enumeration-expected-list"')
    expect(practice).toContain('<li key={`${item}-${itemIndex}`}>{item}</li>')
    expect(practice).not.toContain('Expected items: ${(ans.items || []).join')
    expect(projectFile('src/design.css')).toMatch(/\.practice-prompt--enumeration,\s*\.practice-prompt--identification\s*\{[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*font-size:\s*clamp\(20px, 2\.6vw, 26px\)/)
    expect(projectFile('src/design.css')).toContain('.practice-content-block--identification-prompt { margin-bottom: 24px; }')
  })

  it('matches identification prompt spacing and typography to enumeration', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const identification = practice.slice(practice.indexOf('{/* Identification Mode'), practice.indexOf('{/* Enumeration Mode'))
    const styles = projectFile('src/design.css')

    expect(identification).toContain('className="practice-content-block practice-content-block--identification-prompt"')
    expect(identification).toContain('className="practice-prompt practice-prompt--identification"')
    expect(identification).not.toContain('practice-field-label">Prompt</div>')
    expect(styles).toMatch(/\.practice-context\s*\{[^}]*font-size:\s*clamp\(20px, 2\.6vw, 26px\)/)
  })

  it('keeps study controls compact and offers hints with a lightbulb button', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const styles = projectFile('src/design.css')
    const icons = projectFile('src/components/ui/Icon.tsx')

    expect(styles).toMatch(/\.practice-controls-content\s*\{[^}]*align-items:\s*start;/)
    expect(practice).not.toContain('Need a nudge?')
    expect(practice).toContain('leftIcon="lightbulb"')
    expect(icons).toContain('lightbulb: Lightbulb')
  })

  it('keeps only the due-review action in the inline review queue', () => {
    const practice = projectFile('src/pages/PracticePage.tsx')
    const queue = practice.slice(practice.indexOf('className="practice-review-queue-actions"'), practice.indexOf('</div>', practice.indexOf('className="practice-review-queue-actions"')))

    expect(queue).toContain('Review due')
    expect(queue).toContain('variant="danger"')
    expect(queue).not.toContain('Review now')
  })

  it('centers study modes in a compact card without affecting mobile tabs', () => {
    const styles = projectFile('src/design.css')
    expect(styles).toMatch(/@media \(min-width: 901px\)\s*\{\s*\.practice-mode-tabs \{ justify-content: center; \}/)
    expect(styles).toMatch(/\.practice-mode-tabs \{ gap: 20px !important;/)
    expect(styles).toMatch(/\.practice-mode-tabs \{ gap: 12px !important; overflow-x: auto !important;/)
    expect(styles).toMatch(/\.practice-controls-actions \{[^}]*justify-content: flex-end;/)
    expect(styles).toMatch(/\.practice-controls-card\s*\{[^}]*max-width:\s*900px;[^}]*margin:\s*0 auto 18px;/)
  })

  it('gives the narrow analytics chart a visible scroll affordance', () => {
    const analytics = projectFile('src/pages/AnalyticsPage.tsx')
    const styles = projectFile('src/design.css')
    expect(analytics).toContain('className="table-wrapper trend-chart-scroll"')
    expect(analytics).toContain('scroll horizontally for more dates')
    expect(styles).toContain(".trend-chart-scroll::after { content: 'Swipe or scroll chart for more dates'; }")
  })

  it('removes the course insights subtitle and enlarges its heading', () => {
    const analytics = projectFile('src/pages/AnalyticsPage.tsx')
    const styles = projectFile('src/design.css')
    expect(analytics).toContain("title={isCourse ? 'Study insights' : 'Progress insights'}")
    expect(analytics).toContain("subtitle={isCourse ? undefined :")
    expect(analytics).not.toContain('A closer look at recent practice, subject strengths, and where to focus next.')
    expect(analytics).toContain("className={isCourse ? 'analytics-course-section-header' : undefined}")
    expect(analytics).toContain("title={isCourse ? 'Subject Performance' : 'Per-Module PhLE Performance'}")
    const subjectPerformance = analytics.slice(analytics.indexOf('{/* Per-Subject Performance */}'))
    expect(subjectPerformance).toContain('subtitle={isCourse ? undefined :')
    expect(subjectPerformance).not.toContain('course subjects tracked')
    expect(analytics).toContain("title={isCourse ? 'Subjects to Revisit' : 'Targeted Remediation Drills'}")
    expect(analytics).toContain("subtitle={isCourse ? undefined : 'Focus on these subjects to reach 75%'}")
    expect(analytics).not.toContain('Course subjects below your overall practice average')
    expect(analytics).toContain('if (!profile || isCourse || !weakSubjects.length)')
    expect(analytics).toContain('<Badge variant="warning" size="sm" dot>{s.subject}</Badge>')
    expect(analytics).toContain('{s.percent}% accuracy · Below {PASSING_RATE}% target')
    expect(analytics).toContain('coursePracticePaths[s.subject]')
    expect(analytics).toContain("{practicePath ? 'Practice' : 'No practice set'}")
    expect(styles).toContain('.analytics-course-section-header .ui-card-header-copy h3 { font-size: 22px;')
    expect(styles).toContain('.analytics-course-section-header .ui-card-header-main { align-items: center; }')
    expect(styles).not.toContain('.analytics-course-section-header { justify-content: center; }')
  })

  it('hides the course practice trend that is already shown on the dashboard', () => {
    const analytics = projectFile('src/pages/AnalyticsPage.tsx')
    expect(analytics).toMatch(/\{!isCourse && \(\s*<Card variant="outlined">\s*<CardHeader title=\{isCourse \? 'Course Practice Trend'/s)
  })

  it('creates reviewer titles from uploaded documents instead of asking for a title', () => {
    const reviewer = projectFile('src/pages/ReviewerPage.tsx')
    const ai = projectFile('src/lib/ai.ts')

    expect(reviewer).not.toContain('label="Title"')
    expect(reviewer).toContain('generateMaterialTitle(')
    expect(reviewer).toContain('title: materialTitle')
    expect(reviewer).toContain('filenameMaterialTitle(selectedFile.name)')
    expect(reviewer).toContain('disabled={!!busy || (uploadMode === \'file\' ? !file || !fileReady : !pastedText.trim())}')
    expect(ai).toContain('export async function generateMaterialTitle(source: MaterialSource)')
    expect(ai).toContain('generate one concise, descriptive title for the study material')
  })

  it('supports document, photo OCR, and pasted-text reviewer inputs without video upload', () => {
    const reviewer = projectFile('src/pages/ReviewerPage.tsx')
    const storage = projectFile('src/lib/storage.ts')
    const schema = projectFile('supabase/schema.sql')
    const ai = projectFile('src/lib/ai.ts')

    expect(reviewer).toContain('Files & Photos')
    expect(reviewer).toContain('PASTE YOUR STUDY NOTES')
    expect(reviewer).toContain('AI will scan text in your photo')
    expect(reviewer).toContain('extractTextFromFile({ storagePath, mimeType: selectedFile.type })')
    expect(reviewer).not.toContain('YouTube')
    expect(storage).toContain("'image/jpeg'")
    expect(storage).toContain("'image/heic'")
    expect(schema).toContain("'image/png'")
    expect(ai).toContain('perform OCR on the visible text')
  })

  it('removes the extra reviewer collections and renames the upload destination', () => {
    const reviewer = projectFile('src/pages/ReviewerPage.tsx')
    const layout = projectFile('src/components/Layout.tsx')
    const sidebar = projectFile('src/components/Sidebar.tsx')

    expect(reviewer).not.toContain('Recent Flashcards')
    expect(reviewer).not.toContain('Saved Review Materials')
    expect(reviewer).not.toContain('Upload a document or photo, or paste your notes.')
    expect(layout).toContain("'/reviewer': 'Upload materials'")
    expect(sidebar).toContain("label: 'Upload materials'")
  })
})
