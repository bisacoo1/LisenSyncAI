import type React from 'react'
import UseAnimations, { type Animation } from 'react-useanimations'
import activity from 'react-useanimations/lib/activity'
import alertCircle from 'react-useanimations/lib/alertCircle'
import alertTriangle from 'react-useanimations/lib/alertTriangle'
import arrowDown from 'react-useanimations/lib/arrowDown'
import arrowLeft from 'react-useanimations/lib/arrowLeft'
import arrowRight from 'react-useanimations/lib/arrowRight'
import arrowUpRight from 'react-useanimations/lib/arrowUpRight'
import award from 'react-useanimations/lib/award'
import barChart from 'react-useanimations/lib/barChart'
import bookmark from 'react-useanimations/lib/bookmark'
import bookOpen from 'react-useanimations/lib/bookOpen'
import calendar from 'react-useanimations/lib/calendar'
import check from 'react-useanimations/lib/check'
import checkCircle from 'react-useanimations/lib/checkCircle'
import chevronDown from 'react-useanimations/lib/chevronDown'
import chevronLeft from 'react-useanimations/lib/chevronLeft'
import chevronRight from 'react-useanimations/lib/chevronRight'
import chevronUp from 'react-useanimations/lib/chevronUp'
import clock from 'react-useanimations/lib/clock'
import copy from 'react-useanimations/lib/copy'
import download from 'react-useanimations/lib/download'
import edit from 'react-useanimations/lib/edit'
import externalLink from 'react-useanimations/lib/externalLink'
import file from 'react-useanimations/lib/file'
import fileText from 'react-useanimations/lib/fileText'
import filter from 'react-useanimations/lib/filter'
import flag from 'react-useanimations/lib/flag'
import help from 'react-useanimations/lib/help'
import home from 'react-useanimations/lib/home'
import info from 'react-useanimations/lib/info'
import key from 'react-useanimations/lib/key'
import layout from 'react-useanimations/lib/layout'
import lock from 'react-useanimations/lib/lock'
import logIn from 'react-useanimations/lib/logIn'
import logOut from 'react-useanimations/lib/logOut'
import mail from 'react-useanimations/lib/mail'
import menu from 'react-useanimations/lib/menu'
import messageCircle from 'react-useanimations/lib/messageCircle'
import minus from 'react-useanimations/lib/minus'
import moon from 'react-useanimations/lib/moon'
import notification from 'react-useanimations/lib/notification'
import pieChart from 'react-useanimations/lib/pieChart'
import radioButton from 'react-useanimations/lib/radioButton'
import refreshCcw from 'react-useanimations/lib/refreshCcw'
import rotateCcw from 'react-useanimations/lib/rotateCcw'
import save from 'react-useanimations/lib/save'
import settings from 'react-useanimations/lib/settings'
import share from 'react-useanimations/lib/share'
import shield from 'react-useanimations/lib/shield'
import star from 'react-useanimations/lib/star'
import sun from 'react-useanimations/lib/sun'
import target from 'react-useanimations/lib/target'
import trash from 'react-useanimations/lib/trash'
import trendingUp from 'react-useanimations/lib/trendingUp'
import upload from 'react-useanimations/lib/upload'
import user from 'react-useanimations/lib/user'
import visibility from 'react-useanimations/lib/visibility'
import visibility2 from 'react-useanimations/lib/visibility2'
import volume from 'react-useanimations/lib/volume'
import zap from 'react-useanimations/lib/zap'
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bell, BellOff,
  BookOpen, BookOpenCheck, BookOpenText, Bookmark, BrainCircuit, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown,
  ChevronUp, Circle, CircleDot, CircleHelp, ClipboardCheck, ClipboardList, Clock3, Copy, Download,
  ExternalLink, Eye, EyeOff, FileText, Filter, Flame, Flag, FlaskConical, Folder, GraduationCap, HeartPulse, House,
  Info, KeyRound, LayoutDashboard, Leaf, LibraryBig, ListChecks, LoaderCircle, LockKeyhole,
  LockKeyholeOpen, LogIn, LogOut, Mail, Medal, Menu, MessageSquare, Microscope, Minus, Moon,
  Move, PenLine, PieChart, Pill, Plus, RefreshCw, RotateCcw, Save, Search, Settings,
  Share2, Shield, ShieldCheck, Sparkles, Star, Stethoscope, Sun, Target, Timer, Trash2, TrendingUp, TriangleAlert,
  Trophy, Upload, UserRound, Volume2, X, XCircle, CircleAlert,
  type LucideIcon,
} from 'lucide-react'

// Keep the app's existing icon names as a compatibility layer for both icon sets.
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
  folder: Folder,
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
  'volume-2': Volume2,
  flame: Flame,
  bookmark: Bookmark,
  'clipboard-list': ClipboardList,
  'clipboard-check': ClipboardCheck,
  'list-checks': ListChecks,
  'graduation-cap': GraduationCap,
  pill: Pill,
  flask: FlaskConical,
  leaf: Leaf,
  stethoscope: Stethoscope,
  microscope: Microscope,
  'heart-pulse': HeartPulse,
  'shield-check': ShieldCheck,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof icons

const animatedIcons: Partial<Record<IconName, Animation>> = {
  dashboard: layout,
  reviewer: bookOpen,
  practice: bookOpen,
  mock: clock,
  analytics: barChart,
  logout: logOut,
  login: logIn,
  user,
  mail,
  lock,
  eye: visibility,
  'eye-off': visibility2,
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  'chevron-down': chevronDown,
  'chevron-up': chevronUp,
  minus,
  filter,
  download,
  upload,
  'file-text': fileText,
  'file-pdf': file,
  'book-open': bookOpen,
  timer: clock,
  target,
  'trending-up': trendingUp,
  'alert-triangle': alertTriangle,
  'alert-circle': alertCircle,
  info,
  'help-circle': help,
  'refresh-cw': refreshCcw,
  'rotate-ccw': rotateCcw,
  'arrow-right': arrowRight,
  'arrow-left': arrowLeft,
  'arrow-down': arrowDown,
  'arrow-up-right': arrowUpRight,
  home,
  menu,
  sun,
  moon,
  bell: notification,
  trophy: award,
  star,
  flag,
  clock,
  calendar,
  'bar-chart': barChart,
  'pie-chart': pieChart,
  activity,
  zap,
  shield,
  key,
  edit,
  trash,
  copy,
  share,
  'external-link': externalLink,
  'radio-on': radioButton,
  'radio-off': radioButton,
  'check-circle': checkCircle,
  save,
  comment: messageCircle,
  'volume-2': volume,
  bookmark,
}
export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: IconName
  size?: number | string
  strokeWidth?: number | string
}

export function Icon({ name, size = 20, strokeWidth = 1.8, className = '', ...props }: IconProps) {
  const animation = animatedIcons[name]
  const resolvedClassName = `${className}${name === 'loader' ? ' spin' : ''}`.trim()
  const ariaHidden = props['aria-hidden'] ?? !props['aria-label']

  if (animation) {
    return (
      <UseAnimations
        animation={animation}
        interaction="hover-replay"
        size={size}
        className={resolvedClassName}
        {...props}
        aria-hidden={ariaHidden}
      />
    )
  }

  const Lucide = icons[name]
  return (
    <span
      {...props}
      className={resolvedClassName}
      aria-hidden={ariaHidden}
      style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', ...props.style }}
    >
      <Lucide size={size} strokeWidth={strokeWidth} aria-hidden="true" />
    </span>
  )
}

export default Icon
