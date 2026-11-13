import type React from 'react'
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bell, BellOff,
  BookOpen, BookOpenCheck, BookOpenText, Bookmark, BrainCircuit, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown,
  ChevronUp, Circle, CircleDot, CircleHelp, ClipboardList, Clock3, Copy, Download,
  ExternalLink, Eye, EyeOff, FileText, Filter, Flame, Flag, GraduationCap, House,
  Info, KeyRound, LayoutDashboard, LibraryBig, ListChecks, LoaderCircle, LockKeyhole,
  LockKeyholeOpen, LogIn, LogOut, Mail, Medal, Menu, MessageSquare, Minus, Moon,
  Move, PenLine, PieChart, Plus, RefreshCw, RotateCcw, Save, Search, Settings,
  Share2, Shield, Sparkles, Star, Sun, Target, Timer, Trash2, TrendingUp, TriangleAlert,
  Trophy, Upload, UserRound, X, XCircle, CircleAlert,
  type LucideIcon,
} from 'lucide-react'

// Keep the app's existing icon names as a small compatibility layer, while sourcing
// every interface icon from Lucide. This also gives all screens the same stroke style.
const icons = {
  logo: GraduationCap,
  dashboard: LayoutDashboard,
  reviewer: LibraryBig,
  practice: BookOpenCheck,
  mock: Timer,
  analytics: BarChart3,
  settings: Settings,
  logout: LogOut,
  login: LogIn,
  user: UserRound,
  mail: Mail,
  lock: LockKeyhole,
  eye: Eye,
  'eye-off': EyeOff,
  check: Check,
  x: X,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-up-down': ChevronsUpDown,
  plus: Plus,
  minus: Minus,
  search: Search,
  filter: Filter,
  download: Download,
  upload: Upload,
  'file-text': FileText,
  'file-pdf': FileText,
  'book-open': BookOpen,
  'book-open-text': BookOpenText,
  brain: BrainCircuit,
  timer: Timer,
  target: Target,
  'trending-up': TrendingUp,
  'alert-triangle': TriangleAlert,
  'alert-circle': CircleAlert,
  info: Info,
  'help-circle': CircleHelp,
  'refresh-cw': RefreshCw,
  'rotate-ccw': RotateCcw,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-down': ArrowDown,
  'arrow-up-right': ArrowUpRight,
  home: House,
  menu: Menu,
  sun: Sun,
  moon: Moon,
  bell: Bell,
  'bell-off': BellOff,
  trophy: Trophy,
  medal: Medal,
  star: Star,
  flag: Flag,
  clock: Clock3,
  calendar: CalendarDays,
  'bar-chart': BarChart3,
  'pie-chart': PieChart,
  activity: Activity,
  zap: Sparkles,
  sparkles: Sparkles,
  shield: Shield,
  key: KeyRound,
  unlock: LockKeyholeOpen,
  edit: PenLine,
  trash: Trash2,
  copy: Copy,
  share: Share2,
  'external-link': ExternalLink,
  move: Move,
  'radio-on': CircleDot,
  'radio-off': Circle,
  'check-circle': CheckCircle2,
  'x-circle': XCircle,
  loader: LoaderCircle,
  save: Save,
  comment: MessageSquare,
  flame: Flame,
  bookmark: Bookmark,
  'clipboard-list': ClipboardList,
  'list-checks': ListChecks,
  'graduation-cap': GraduationCap,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof icons

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName
  size?: number | string
  strokeWidth?: number | string
}

export function Icon({ name, size = 20, strokeWidth = 1.8, className = '', ...props }: IconProps) {
  const Lucide = icons[name]
  if (!Lucide) return null
  return (
    <Lucide
      size={size}
      strokeWidth={strokeWidth}
      className={`${className}${name === 'loader' ? ' spin' : ''}`.trim()}
      aria-hidden={props['aria-hidden'] ?? true}
      {...props}
    />
  )
}

export default Icon
