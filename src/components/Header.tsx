import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Edit3,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  OfficialProfile,
  PageRoute,
  SLAC_COLLEGE_DEPARTMENTS,
  SLAC_YEAR_LEVELS,
  StudentProfile,
  siteConfig,
} from '../siteConfig';
import type { ThemeMode } from '../App';
import { ResistiveFilterBar } from './ResistiveFilterBar';
import type { AuthModalMode } from './OfficialAuthModal';

interface HeaderProps {
  currentPage: PageRoute;
  official: OfficialProfile | null;
  student: StudentProfile | null;
  theme: ThemeMode;
  customLogoUrl?: string;
  unreadCounts?: {
    announcements: number;
    events: number;
    forum: number;
  };
  onToggleTheme: () => void;
  onNavigate: (page: PageRoute) => void;
  onOpenAuth: (mode: AuthModalMode) => void;
  onUpdateStudentIdentity?: (name: string, yearCourse: string) => void;
  onSignOutOfficial: () => void;
  onSignOutStudent: () => void;
}

const MOBILE_PAGE_ICONS: Record<PageRoute, typeof Home> = {
  home: Home,
  announcements: Megaphone,
  events: Calendar,
  officers: Users,
  forum: MessageSquare,
  faq: HelpCircle,
  admin: LayoutDashboard,
};

const NAV_TONE_BY_PAGE: Record<
  PageRoute,
  'neutral' | 'amber' | 'green' | 'yellow' | 'red'
> = {
  home: 'green',
  announcements: 'amber',
  events: 'red',
  officers: 'green',
  forum: 'yellow',
  faq: 'amber',
  admin: 'green',
};

function parseDept(yearCourse?: string): string {
  if (!yearCourse) return SLAC_COLLEGE_DEPARTMENTS[0];
  const matched = SLAC_COLLEGE_DEPARTMENTS.find((dept) =>
    yearCourse.toLowerCase().includes(dept.toLowerCase())
  );
  return matched ?? SLAC_COLLEGE_DEPARTMENTS[0];
}

function parseYear(yearCourse?: string): string {
  if (!yearCourse) return SLAC_YEAR_LEVELS[0];
  const matched = SLAC_YEAR_LEVELS.find((yr) =>
    yearCourse.toLowerCase().includes(yr.toLowerCase())
  );
  return matched ?? SLAC_YEAR_LEVELS[0];
}

/**
 * HEADER SECTION
 * - Consistently blurred frosted glass surface at all scroll depths.
 * - Folds upward (hides) when scrolling down, unfolds (shows) when scrolling up.
 * - Clean, organized 3-zone flex layout: Brand on left, centered nav links on desktop, Menu Drawer button on right.
 * - Theme toggle and signed-in user profile live inside the Menu Drawer so the top bar never clips nav links.
 * - Mobile inner-page section switcher is detached from <header> and rendered as a separate floating pill bar below.
 */
export function Header({
  currentPage,
  official,
  student,
  theme,
  unreadCounts,
  onToggleTheme,
  onNavigate,
  onOpenAuth,
  onUpdateStudentIdentity,
  onSignOutOfficial,
  onSignOutStudent,
}: HeaderProps) {
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const [isFolded, setIsFolded] = useState(false);

  const scrollTickingRef = useRef(false);
  const lastScrollYRef = useRef(0);

  const [editStudentName, setEditStudentName] = useState(student?.name ?? '');
  const [editMode, setEditMode] = useState<'picker' | 'custom' | 'skip'>(
    'picker'
  );
  const [editDept, setEditDept] = useState<string>(() =>
    parseDept(student?.yearCourse)
  );
  const [editYear, setEditYear] = useState<string>(() =>
    parseYear(student?.yearCourse)
  );
  const [editCustomCourse, setEditCustomCourse] = useState<string>(
    student?.yearCourse ?? ''
  );

  const openIdentityEditor = () => {
    if (!student) return;
    setEditStudentName(student.name);
    const yrCourse = student.yearCourse || '';
    const hasDeptMatch = SLAC_COLLEGE_DEPARTMENTS.some((d) =>
      yrCourse.toLowerCase().includes(d.toLowerCase())
    );
    if (!yrCourse || yrCourse === 'SLAC Student') {
      setEditMode('skip');
    } else if (hasDeptMatch) {
      setEditMode('picker');
      setEditDept(parseDept(yrCourse));
      setEditYear(parseYear(yrCourse));
    } else {
      setEditMode('custom');
      setEditCustomCourse(yrCourse);
    }
    setIdentityModalOpen(true);
  };

  const handleSaveIdentity = (e: FormEvent) => {
    e.preventDefault();
    if (!student || !onUpdateStudentIdentity) return;
    const resolvedCourse =
      editMode === 'skip'
        ? 'SLAC Student'
        : editMode === 'custom'
          ? editCustomCourse.trim().slice(0, 80) || 'SLAC Student'
          : `${editYear} — ${editDept}`;
    onUpdateStudentIdentity(
      editStudentName.trim() || student.name,
      resolvedCourse
    );
    setIdentityModalOpen(false);
  };

  // Track scroll position for frosted elevation and directional fold/unfold
  useEffect(() => {
    const HEADER_HEIGHT = 64;
    const PAST_HERO_BUFFER = 72;
    const NO_HERO_THRESHOLD = 24;

    lastScrollYRef.current = Math.max(
      0,
      window.scrollY || document.documentElement.scrollTop || 0
    );
    setIsFolded(false);

    const updateHeaderState = () => {
      scrollTickingRef.current = false;
      const currentScrollY = Math.max(
        0,
        window.scrollY || document.documentElement.scrollTop || 0
      );
      const prevScrollY = lastScrollYRef.current;
      const deltaY = currentScrollY - prevScrollY;

      const heroStage = document.getElementById('hero-stage');
      if (heroStage) {
        const heroBottom = heroStage.getBoundingClientRect().bottom;
        setIsFilled(heroBottom <= HEADER_HEIGHT - PAST_HERO_BUFFER);
      } else {
        setIsFilled(currentScrollY > NO_HERO_THRESHOLD);
      }

      if (currentScrollY <= 56) {
        setIsFolded(false);
      } else if (deltaY > 8 && currentScrollY > 72) {
        // Scrolling down -> fold header upward
        setIsFolded(true);
      } else if (deltaY < -5) {
        // Scrolling up -> unfold header
        setIsFolded(false);
      }

      lastScrollYRef.current = currentScrollY;
    };

    const handleScroll = () => {
      if (!scrollTickingRef.current) {
        scrollTickingRef.current = true;
        window.requestAnimationFrame(updateHeaderState);
      }
    };

    updateHeaderState();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [currentPage]);

  // Lock background page scroll & listen for Escape when Menu Drawer is open
  useEffect(() => {
    if (!menuDrawerOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuDrawerOpen]);

  const handleNavigateSelect = (page: PageRoute) => {
    setMenuDrawerOpen(false);
    onNavigate(page);
  };

  const getBadgeCount = (page: PageRoute): number => {
    if (!unreadCounts) return 0;
    if (page === 'announcements') return unreadCounts.announcements;
    if (page === 'events') return unreadCounts.events;
    if (page === 'forum') return unreadCounts.forum;
    return 0;
  };

  const totalUnread =
    (unreadCounts?.announcements ?? 0) +
    (unreadCounts?.events ?? 0) +
    (unreadCounts?.forum ?? 0);

  const mobileNavOptions = [
    ...siteConfig.header.navItems.map((item) => {
      const Icon = MOBILE_PAGE_ICONS[item.page];
      const badge = getBadgeCount(item.page);
      const tone = NAV_TONE_BY_PAGE[item.page];
      return {
        value: item.page as PageRoute,
        label: badge > 0 ? `${item.label} (${badge})` : item.label,
        badgeCount: badge,
        rawLabel: item.label,
        tone: tone === 'neutral' ? 'green' : tone,
        icon: <Icon className="h-3.5 w-3.5" aria-hidden="true" />,
      };
    }),
    ...(official
      ? [
          {
            value: 'admin' as PageRoute,
            label: 'SSC Suite',
            badgeCount: 0,
            rawLabel: 'SSC Suite',
            tone: 'green' as const,
            icon: <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />,
          },
        ]
      : []),
  ];

  // When SSC Suite (Admin) is active, it renders its own full-screen Strapi-style workspace shell
  if (currentPage === 'admin') {
    return null;
  }

  const headerFillClass =
    isFilled || menuDrawerOpen ? 'karst-header-solid' : 'karst-header-glass';
  const foldTransformClass =
    isFolded && !menuDrawerOpen ? '-translate-y-full' : 'translate-y-0';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 w-full ${headerFillClass} ${foldTransformClass}`}
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1 (Left): Smart Council Wordmark */}
          <div className="shrink-0 flex items-center">
            <button
              type="button"
              onClick={() => handleNavigateSelect('home')}
              className="inline-flex items-center justify-start whitespace-nowrap shrink-0 cursor-pointer focus-visible:rounded-md py-1"
            >
              <span className="karst-wordmark text-[#f5f4f0]">
                {siteConfig.brand.name}
              </span>
            </button>
          </div>

          {/* Zone 2 (Center): Desktop Navigation Links (Never clipped) */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center justify-center gap-5 xl:gap-7 shrink-0"
          >
            {siteConfig.header.navItems.map((item) => {
              const isActive = currentPage === item.page;
              const badge = getBadgeCount(item.page);
              const tone = NAV_TONE_BY_PAGE[item.page];
              const indicatorColor =
                tone === 'amber'
                  ? 'bg-[#e8985e]'
                  : tone === 'red'
                    ? 'bg-[#ef4444]'
                    : tone === 'yellow'
                      ? 'bg-[#facc15]'
                      : 'bg-[#3ddc97]';
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigate(item.page)}
                  className={`relative inline-flex items-center gap-1.5 py-2 px-0.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#f5f4f0] font-semibold'
                      : 'text-[#b4bac6] hover:text-[#f5f4f0]'
                  }`}
                >
                  <span>{item.label}</span>
                  {badge > 0 && (
                    <span
                      aria-label={`${badge} new`}
                      className="inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-bold text-white leading-none tabular-nums shadow-xs"
                    >
                      {badge}
                    </span>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="active-nav-indicator"
                      aria-hidden="true"
                      className={`absolute left-0 right-0 bottom-0 h-[2px] rounded-full ${indicatorColor}`}
                      transition={{
                        type: 'spring',
                        stiffness: 460,
                        damping: 34,
                      }}
                    />
                  )}
                </button>
              );
            })}

            {official && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="relative inline-flex items-center gap-1.5 py-2 px-1 text-sm font-medium text-[#b4bac6] hover:text-[#f5f4f0] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LayoutDashboard
                  className="h-3.5 w-3.5 text-[#3ddc97]"
                  aria-hidden="true"
                />
                <span>SSC Suite</span>
              </button>
            )}
          </nav>

          {/* Zone 3 (Right): Sign In CTA (when signed out) + Menu Drawer Toggle */}
          <div className="shrink-0 flex items-center justify-end gap-2.5">
            {!official && !student && (
              <button
                type="button"
                aria-label="Sign in as Student or SSC Official"
                onClick={() => onOpenAuth('student')}
                className="hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-lg border border-white/[0.16] bg-[#121620] text-[#f5f4f0] hover:border-white/[0.28] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5 text-[#3ddc97]" aria-hidden="true" />
                <span>{siteConfig.header.primaryButtonText}</span>
              </button>
            )}

            {/* Menu Drawer Button (Available on all screen sizes; houses Theme Toggle & User Profile) */}
            <button
              type="button"
              aria-label={
                menuDrawerOpen ? 'Close menu drawer' : 'Open menu drawer'
              }
              aria-expanded={menuDrawerOpen}
              aria-controls="portal-menu-drawer"
              onClick={() => setMenuDrawerOpen((prev) => !prev)}
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.14] bg-[#121620]/70 text-[#f5f4f0] hover:border-white/[0.28] active:scale-95 transition-all duration-150 cursor-pointer"
            >
              {menuDrawerOpen ? (
                <X className="h-4.5 w-4.5" aria-hidden="true" />
              ) : (
                <Menu className="h-4.5 w-4.5" aria-hidden="true" />
              )}
              {!menuDrawerOpen && (official || student) && totalUnread === 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0d1017] ${
                    official ? 'bg-[#3ddc97]' : 'bg-[#facc15]'
                  }`}
                />
              )}
              {!menuDrawerOpen && totalUnread > 0 && (
                <span
                  aria-label={`${totalUnread} new notifications`}
                  className="absolute -top-1.5 -right-1.5 inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white tabular-nums shadow-sm"
                >
                  {totalUnread}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* In-Flow Spacer Matching Fixed Header Height on Inner Pages */}
      <div
        aria-hidden="true"
        className={
          currentPage !== 'home' ? 'h-16 shrink-0' : 'h-0 shrink-0'
        }
      />

      {/* Separate In-Page Mobile Section Switcher Pill Bar (< lg) */}
      {currentPage !== 'home' && (
        <div className="lg:hidden mx-auto w-full max-w-[1440px] px-4 sm:px-8 pt-3.5 pb-1.5">
          <div className="rounded-xl border border-white/[0.14] bg-[#121620]/90 backdrop-blur-md p-1.5 shadow-sm">
            <nav aria-label="Mobile section switcher" className="w-full">
              <ResistiveFilterBar
                surface="nav"
                compact
                ariaLabel="Mobile section switcher"
                value={currentPage}
                onChange={(page) => handleNavigateSelect(page)}
                options={mobileNavOptions}
                className="w-full"
              />
            </nav>
          </div>
        </div>
      )}

      {/* Portaled Facebook-Style Right Slide-In Menu Drawer */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {menuDrawerOpen && (
              <div className="fixed inset-0 z-[70] overflow-hidden">
                {/* Soft Dimmed Background Overlay */}
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  onClick={() => setMenuDrawerOpen(false)}
                  className="fixed inset-0 bg-black/55 touch-none select-none"
                />

                {/* Full-Height Right Slide-In Drawer (Facebook Menu Style) */}
                <motion.aside
                  id="portal-menu-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu and account settings"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 36,
                    mass: 0.85,
                  }}
                  className="fixed top-0 right-0 bottom-0 z-[75] w-full max-w-[360px] flex flex-col border-l border-white/[0.16] bg-[#0d1017] shadow-2xl will-change-transform"
                >
                  {/* Drawer Top Header Bar */}
                  <div className="shrink-0 flex items-center justify-between px-5 h-16 border-b border-white/[0.12] bg-[#121620]">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg font-bold tracking-tight text-[#f5f4f0]">
                        Menu
                      </span>
                      <span className="rounded-md border border-white/[0.14] bg-[#181d29] px-2 py-0.5 text-[11px] font-semibold text-[#b4bac6]">
                        {official
                          ? 'Official'
                          : student
                            ? 'Student'
                            : 'Guest'}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Close menu"
                      onClick={() => setMenuDrawerOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.14] bg-[#181d29] text-[#b4bac6] hover:text-[#f5f4f0] active:scale-95 transition-all cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Scrollable Drawer Body */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar p-4 sm:p-5 space-y-5 touch-pan-y">
                    {/* 1. Facebook-Style Profile Card */}
                    {official ? (
                      <div className="rounded-2xl border border-white/[0.16] bg-[#121620] p-4 shadow-sm space-y-3.5">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3ddc97]/15 border border-[#3ddc97]/35 text-[#3ddc97]">
                            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-[#f5f4f0] truncate">
                              {official.name}
                            </p>
                            <p className="text-xs text-[#949ba8] truncate">
                              {official.position}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-white/[0.1] flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleNavigateSelect('admin')}
                            className="inline-flex flex-1 min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.16] bg-[#181d29] px-3 py-1.5 text-xs font-semibold text-[#f5f4f0] hover:border-white/[0.28] transition-colors cursor-pointer"
                          >
                            <LayoutDashboard
                              className="h-3.5 w-3.5 text-[#3ddc97]"
                              aria-hidden="true"
                            />
                            <span>Open SSC Suite</span>
                          </button>
                        </div>
                      </div>
                    ) : student ? (
                      <div className="rounded-2xl border border-white/[0.16] bg-[#121620] p-4 shadow-sm space-y-3.5">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#facc15]/15 border border-[#facc15]/35 text-[#facc15]">
                            <GraduationCap
                              className="h-5 w-5"
                              aria-hidden="true"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-[#f5f4f0] truncate">
                              {student.name}
                            </p>
                            <p className="text-xs text-[#949ba8] truncate">
                              {student.yearCourse || 'SLAC Student'}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-white/[0.1] flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuDrawerOpen(false);
                              openIdentityEditor();
                            }}
                            className="inline-flex flex-1 min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.16] bg-[#181d29] px-3 py-1.5 text-xs font-semibold text-[#f5f4f0] hover:border-white/[0.28] transition-colors cursor-pointer"
                          >
                            <Edit3
                              className="h-3.5 w-3.5 text-[#3ddc97]"
                              aria-hidden="true"
                            />
                            <span>Edit Student Profile</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/[0.16] bg-[#121620] p-4 shadow-sm space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-[#f5f4f0]">
                            Sign in to Smart Council
                          </p>
                          <p className="text-xs text-[#949ba8] leading-relaxed">
                            Post in the Student Forum, support proposals, or access SSC Suite.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuDrawerOpen(false);
                            onOpenAuth('student');
                          }}
                          className="gemini-cta inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
                        >
                          <LogIn
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{siteConfig.header.primaryButtonText}</span>
                        </button>
                      </div>
                    )}

                    {/* 2. Mobile-Only Vertical Navigation List (Hidden on Desktop >= lg where header shows links) */}
                    <div className="lg:hidden space-y-2">
                      <div className="flex items-center justify-between px-1 text-xs text-[#949ba8]">
                        <span className="font-semibold text-[#f5f4f0]">
                          Navigation
                        </span>
                        <span className="tabular-nums">
                          {mobileNavOptions.length} sections
                        </span>
                      </div>

                      <nav
                        aria-label="Mobile drawer navigation"
                        className="flex flex-col gap-1.5"
                      >
                        {mobileNavOptions.map((option) => {
                          const isActive = currentPage === option.value;
                          const accentText =
                            option.tone === 'amber'
                              ? 'text-[#e8985e]'
                              : option.tone === 'red'
                                ? 'text-[#f87171]'
                                : option.tone === 'yellow'
                                  ? 'text-[#facc15]'
                                  : 'text-[#3ddc97]';

                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-current={isActive ? 'page' : undefined}
                              onClick={() => handleNavigateSelect(option.value)}
                              className={`flex w-full min-h-[46px] items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.24] shadow-xs'
                                  : 'bg-[#121620] text-[#b4bac6] hover:text-[#f5f4f0] border border-white/[0.12]'
                              }`}
                            >
                              <span className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b0e15] border border-white/[0.1] ${accentText}`}
                                >
                                  {option.icon}
                                </span>
                                <span className="truncate font-semibold">
                                  {option.rawLabel}
                                </span>
                              </span>

                              <span className="flex items-center gap-2 shrink-0 text-xs">
                                {option.badgeCount > 0 && (
                                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-bold text-white tabular-nums">
                                    {option.badgeCount}
                                  </span>
                                )}
                                {isActive && (
                                  <span className={`font-semibold ${accentText}`}>
                                    Active
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* 3. Settings & Appearance (Display / Theme Mode) */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1 text-xs text-[#949ba8]">
                        <div className="flex items-center gap-1.5 font-semibold text-[#f5f4f0]">
                          <Settings
                            className="h-3.5 w-3.5 text-[#3ddc97]"
                            aria-hidden="true"
                          />
                          <span>Display &amp; Accessibility</span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/[0.14] bg-[#121620] p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-[#f5f4f0]">
                              Theme Appearance
                            </p>
                            <p className="text-[11px] text-[#949ba8]">
                              {theme === 'dark'
                                ? 'Warm charcoal dark mode active'
                                : 'Eye-friendly warm stone light mode active'}
                            </p>
                          </div>
                          {theme === 'dark' ? (
                            <Moon
                              className="h-4 w-4 text-[#3ddc97] shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <Sun
                              className="h-4 w-4 text-[#facc15] shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0b0e15] border border-white/[0.12]">
                          <button
                            type="button"
                            onClick={() => {
                              if (theme !== 'light') onToggleTheme();
                            }}
                            className={`inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              theme === 'light'
                                ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.18] shadow-xs'
                                : 'text-[#949ba8] hover:text-[#f5f4f0]'
                            }`}
                          >
                            <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Light</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (theme !== 'dark') onToggleTheme();
                            }}
                            className={`inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              theme === 'dark'
                                ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.18] shadow-xs'
                                : 'text-[#949ba8] hover:text-[#f5f4f0]'
                            }`}
                          >
                            <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Dark</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Drawer Bottom Footer (Sign Out when authenticated) */}
                  {(official || student) && (
                    <div className="shrink-0 p-4 border-t border-white/[0.12] bg-[#121620]">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuDrawerOpen(false);
                          if (official) {
                            onSignOutOfficial();
                          } else {
                            onSignOutStudent();
                          }
                        }}
                        className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2 text-xs font-semibold text-[#fca5a5] hover:bg-red-500/20 transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  )}
                </motion.aside>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Website Settings: Student Identity Editor Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {identityModalOpen && student && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="student-identity-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => setIdentityModalOpen(false)}
                className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleSaveIdentity}
                  className="w-full max-w-md rounded-2xl border border-white/[0.16] bg-[#131519] overflow-hidden shadow-2xl"
                >
                  <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/[0.12]">
                    <div>
                      <h3
                        id="student-identity-modal-title"
                        className="text-lg sm:text-xl font-bold text-[#f5f4f0]"
                      >
                        Student Identity Settings
                      </h3>
                      <p className="mt-0.5 text-xs text-[#949ba8]">
                        Update how your name and department appear in the Student Forum.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close identity settings"
                      onClick={() => setIdentityModalOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#949ba8] hover:text-[#f5f4f0] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="p-5 sm:p-6 space-y-4">
                    <div>
                      <label
                        htmlFor="settings-student-name"
                        className="block text-xs font-semibold text-[#b4bac6] mb-1"
                      >
                        Display Name
                      </label>
                      <input
                        id="settings-student-name"
                        type="text"
                        required
                        value={editStudentName}
                        onChange={(e) => setEditStudentName(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0]"
                      />
                    </div>

                    <div className="space-y-3">
                      <span className="block text-xs font-semibold text-[#b4bac6]">
                        Department &amp; Year / Custom Identity
                      </span>

                      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0b0e15] border border-white/[0.12]">
                        {(
                          [
                            { id: 'picker', label: 'Dept & Year' },
                            { id: 'custom', label: 'Custom' },
                            { id: 'skip', label: 'Optional' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setEditMode(tab.id)}
                            className={`h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              editMode === tab.id
                                ? 'bg-[#3ddc97] text-[#042412]'
                                : 'text-[#949ba8] hover:text-[#f5f4f0]'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {editMode === 'picker' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-[#949ba8] mb-1">
                              College Department
                            </label>
                            <select
                              value={editDept}
                              onChange={(e) => setEditDept(e.target.value)}
                              className="w-full min-h-[40px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-2.5 py-2 text-xs text-[#f5f4f0]"
                            >
                              {SLAC_COLLEGE_DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs text-[#949ba8] mb-1">
                              Year Level
                            </label>
                            <select
                              value={editYear}
                              onChange={(e) => setEditYear(e.target.value)}
                              className="w-full min-h-[40px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-2.5 py-2 text-xs text-[#f5f4f0]"
                            >
                              {SLAC_YEAR_LEVELS.map((yr) => (
                                <option key={yr} value={yr}>
                                  {yr}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {editMode === 'custom' && (
                        <div>
                          <label className="block text-xs text-[#949ba8] mb-1">
                            Custom Identity
                          </label>
                          <input
                            type="text"
                            maxLength={80}
                            value={editCustomCourse}
                            onChange={(e) => setEditCustomCourse(e.target.value)}
                            placeholder="e.g. 3rd Year — BS Computer Engineering"
                            className="w-full min-h-[40px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                          />
                        </div>
                      )}

                      {editMode === 'skip' && (
                        <p className="text-xs text-[#949ba8]">
                          Your identity will simply display as &ldquo;SLAC Student&rdquo;.
                        </p>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIdentityModalOpen(false)}
                        className="min-h-[38px] px-4 py-1.5 rounded-lg border border-white/[0.14] bg-[#181d29] text-xs font-medium text-[#b4bac6] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Save Identity
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
