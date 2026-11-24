export interface AppDestination {
  title: string
  path: string
  aliases: string[]
}

export const APP_DESTINATIONS: AppDestination[] = [
  {
    title: 'Upload materials',
    path: '/reviewer?tab=upload',
    aliases: ['upload', 'add material', 'import material', 'course material', 'upload file'],
  },
  {
    title: 'Mock exam',
    path: '/mock',
    aliases: ['mock exam', 'mock test', 'timed exam', 'exam simulation'],
  },
  {
    title: 'Game mode',
    path: '/game',
    aliases: ['game mode', 'rx runner', 'game'],
  },
  {
    title: 'Study mode',
    path: '/practice',
    aliases: ['flashcards', 'flash cards', 'study mode', 'practice questions', 'practice', 'quiz'],
  },
  {
    title: 'My reviewers',
    path: '/reviewers',
    aliases: ['my reviewers', 'reviewers', 'study sets', 'saved materials', 'my materials'],
  },
  {
    title: 'Analytics',
    path: '/analytics',
    aliases: ['analytics', 'statistics', 'stats', 'progress chart', 'accuracy'],
  },
  {
    title: 'Leaderboards',
    path: '/leaderboard',
    aliases: ['leaderboard', 'leaderboards', 'rankings', 'weekly ranking', 'monthly ranking'],
  },
  {
    title: 'Friends',
    path: '/friends',
    aliases: ['friends', 'friend requests', 'my friends', 'people i added'],
  },
  {
    title: 'Achievements',
    path: '/achievements',
    aliases: ['achievements', 'achievement', 'badges', 'rewards', 'streak'],
  },
  {
    title: 'Side-by-side reader',
    path: '/side-by-side',
    aliases: ['side by side', 'document reader', 'read a document'],
  },
  {
    title: 'Overview',
    path: '/dashboard',
    aliases: ['dashboard', 'overview', 'home page', 'course subjects'],
  },
]

export function findAppDestination(message: string): AppDestination | null {
  const normalized = message.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  const isNavigationRequest = /\b(where|find|looking for|help me find|open|navigate|go to|take me|access|locate|show me|how to|how do i|how can i|need to|want to|start)\b/.test(normalized)
  if (!isNavigationRequest) return null

  return APP_DESTINATIONS.find(destination =>
    destination.aliases.some(alias => normalized.includes(alias))
  ) ?? null
}
