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
import { SiteLogo } from './SiteLogo';
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
 * - Fixed top bar that smoothly folds away when scrolling down and reveals itself when scrolling up.
 * - Glassmorphic at the top edge (scrollY = 0) and smoothly interpolates to solid website color as you scroll.
 * - Non-overlapping 3-zone flex architecture so navigation items never collide with the right-side profile pill.
 * - Portaled GPU-accelerated Burger Menu with Claude Window Bar, Karst boxy outer frame, and rounded inner cards.
 */
export function Header({
  currentPage,
  official,
  student,
  theme,
  customLogoUrl,
  unreadCounts,
  onToggleTheme,
  onNavigate,
  onOpenAuth,
  onUpdateStudentIdentity,
  onSignOutOfficial,
  onSignOutStudent,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [scrollRatio, setScrollRatio] = useState(0);

  const lastScrollYRef = useRef(0);
  const scrollTickingRef = useRef(false);

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

  // Reveal header whenever navigating to a new page or opening menus
  useEffect(() => {
    const currentY = Math.max(0, window.scrollY || 0);
    setIsHeaderHidden(false);
    setScrollRatio(
      currentY <= 8 ? 0 : Math.min(1, (currentY - 8) / 88)
    );
    lastScrollYRef.current = currentY;
  }, [currentPage, mobileMenuOpen, identityModalOpen]);

  // Slowly fold header when scrolling down deeper, reveal when scrolling up,
  // and transition from glassmorphism at the top edge (0px) to 100% solid theme color as it scrolls/moves away
  useEffect(() => {
    const initialY = Math.max(0, window.scrollY || 0);
    lastScrollYRef.current = initialY;
    setScrollRatio(
      initialY <= 8 ? 0 : Math.min(1, (initialY - 8) / 88)
    );

    const updateHeaderVisibility = () => {
      scrollTickingRef.current = false;
      const currentScrollY = Math.max(
        0,
        window.scrollY || document.documentElement.scrollTop || 0
      );

      // Smoothly interpolate from pure glass at top edge (<= 8px) to solid color as it moves away
      const nextRatio =
        currentScrollY <= 8 ? 0 : Math.min(1, (currentScrollY - 8) / 88);
      setScrollRatio(nextRatio);

      if (mobileMenuOpen || identityModalOpen || currentScrollY < 110) {
        setIsHeaderHidden(false);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const delta = currentScrollY - lastScrollYRef.current;

      if (delta > 12) {
        setIsHeaderHidden(true);
        lastScrollYRef.current = currentScrollY;
      } else if (delta < -6) {
        setIsHeaderHidden(false);
        lastScrollYRef.current = currentScrollY;
      }
    };

    const handleScroll = () => {
      if (!scrollTickingRef.current) {
        scrollTickingRef.current = true;
        window.requestAnimationFrame(updateHeaderVisibility);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mobileMenuOpen, identityModalOpen]);

  // Lock background page scroll & listen for Escape when Burger Menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleMobileNavigate = (page: PageRoute) => {
    setMobileMenuOpen(false);
    setIsHeaderHidden(false);
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
            label: 'Admin',
            badgeCount: 0,
            rawLabel: 'Admin',
            tone: 'green' as const,
            icon: <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />,
          },
        ]
      : []),
  ];

  const shouldFoldHeader =
    isHeaderHidden && !mobileMenuOpen && !identityModalOpen;

  // Glassmorphism when fully extended at top edge (scrollRatio = 0) with zero shadow/depth step;
  // transitions to 100% solid theme color when scrolling down or moving away (shouldFoldHeader)
  const effectiveSolidRatio =
    mobileMenuOpen || shouldFoldHeader ? 1 : scrollRatio;
  const isSolid = effectiveSolidRatio >= 0.96;
  const bgAlpha = isSolid ? 1 : 0.12 + effectiveSolidRatio * 0.88;
  const blurPx = isSolid ? 0 : Math.max(4, Math.round(12 - effectiveSolidRatio * 8));

  const headerDynamicStyle =
    theme === 'dark'
      ? {
          backgroundColor: isSolid
            ? '#111312'
            : `rgba(17, 19, 18, ${bgAlpha.toFixed(3)})`,
          backdropFilter: isSolid ? 'none' : `blur(${blurPx}px)`,
          WebkitBackdropFilter: isSolid ? 'none' : `blur(${blurPx}px)`,
          borderBottom: 'none',
          boxShadow: 'none',
        }
      : {
          backgroundColor: isSolid
            ? '#f5f3ee'
            : `rgba(245, 243, 238, ${bgAlpha.toFixed(3)})`,
          backdropFilter: isSolid ? 'none' : `blur(${blurPx}px)`,
          WebkitBackdropFilter: isSolid ? 'none' : `blur(${blurPx}px)`,
          borderBottom: 'none',
          boxShadow: 'none',
        };

  return (
    <>
      <motion.header
        initial={false}
        animate={{ y: shouldFoldHeader ? '-100%' : '0%' }}
        transition={{
          duration: 0.58,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={headerDynamicStyle}
        className={`fixed top-0 left-0 right-0 z-50 w-full will-change-transform transition-[background-color,backdrop-filter] duration-300 ease-out ${
          shouldFoldHeader ? 'pointer-events-none' : ''
        }`}
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 h-16 flex items-center justify-between gap-3 xl:gap-6">
          {/* Zone 1: Brand Crest & Wordmark (shrink-0 so it never compresses) */}
          <div className="shrink-0 flex items-center gap-2.5">
            <SiteLogo
              onNavigate={handleMobileNavigate}
              customLogoUrl={customLogoUrl}
            />
          </div>

          {/* Zone 2: Desktop Single-Line Navigation (flex-1 min-w-0 so it absorbs width cleanly without overlapping Zone 3) */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex flex-1 min-w-0 items-center justify-center gap-3.5 xl:gap-7 px-2 overflow-x-auto no-scrollbar"
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
                  className={`relative inline-flex items-center gap-1.5 py-2 px-1 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
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
                aria-current={currentPage === 'admin' ? 'page' : undefined}
                onClick={() => onNavigate('admin')}
                className={`relative inline-flex items-center gap-1.5 py-2 px-1 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  currentPage === 'admin'
                    ? 'text-[#3ddc97] font-semibold'
                    : 'text-[#b4bac6] hover:text-[#f5f4f0]'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Admin</span>
                {currentPage === 'admin' && (
                  <motion.span
                    layoutId="active-nav-indicator"
                    aria-hidden="true"
                    className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-[#3ddc97]"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  />
                )}
              </button>
            )}
          </nav>

          {/* Zone 3: Desktop Controls (Theme + Auth) & Burger Button (borderless so header blends flawlessly) */}
          <div className="shrink-0 flex items-center justify-end gap-2">
            {/* Desktop-Only Theme Toggle */}
            <button
              type="button"
              aria-label={
                theme === 'dark'
                  ? 'Switch to light theme'
                  : 'Switch to dark theme'
              }
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={onToggleTheme}
              className="hidden lg:inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#facc15]" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-[#3ddc97]" aria-hidden="true" />
              )}
            </button>

            {/* Desktop-Only Account & Quick Sign-Out */}
            <div className="hidden lg:flex items-center shrink-0">
              {official ? (
                <div className="flex items-center gap-2 rounded-xl px-2.5 py-1 shrink-0">
                  <ShieldCheck
                    className="h-4 w-4 text-[#3ddc97] shrink-0"
                    aria-hidden="true"
                  />
                  <div className="text-left leading-tight max-w-[132px] xl:max-w-[168px]">
                    <p className="text-xs font-semibold text-[#f5f4f0] truncate">
                      {official.name}
                    </p>
                    <p className="text-[10px] text-[#949ba8] truncate">
                      {official.position}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Sign out of SSC Official session"
                    title="Sign out"
                    onClick={onSignOutOfficial}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f87171] hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : student ? (
                <div className="flex items-center gap-1 rounded-xl pl-1.5 pr-1 py-1 shrink-0">
                  <button
                    type="button"
                    aria-label="Edit student identity in settings"
                    title="Edit Identity Settings"
                    onClick={openIdentityEditor}
                    className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-left hover:bg-black/5 dark:hover:bg-white/[0.05] transition-colors cursor-pointer max-w-[140px] xl:max-w-[175px]"
                  >
                    <GraduationCap
                      className="h-4 w-4 text-[#facc15] shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 leading-tight">
                      <p className="text-xs font-semibold text-[#f5f4f0] truncate">
                        {student.name}
                      </p>
                      <p className="text-[10px] text-[#949ba8] truncate">
                        {student.yearCourse || 'SLAC Student'}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Sign out of student profile"
                    title="Sign out"
                    onClick={onSignOutStudent}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f87171] hover:bg-black/5 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label="Sign in as Student or SSC Official"
                  onClick={() => onOpenAuth('student')}
                  className="gemini-cta inline-flex items-center justify-center gap-1.5 h-10 px-4 text-xs font-bold uppercase tracking-[0.06em] rounded-full active:scale-[0.98] transition-transform duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{siteConfig.header.primaryButtonText}</span>
                </button>
              )}
            </div>

            {/* Burger Menu Toggle (< lg) */}
            <button
              type="button"
              aria-label={
                mobileMenuOpen
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="relative inline-flex lg:hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#f5f4f0] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform duration-150 cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
              {!mobileMenuOpen && totalUnread > 0 && (
                <span
                  aria-label={`${totalUnread} new notifications`}
                  className="
                    absolute -top-1 -right-1 inline-flex h-4.5 min-w-[18px]
                    items-center justify-center rounded-full bg-[#ef4444] px-1
                    text-[10px] font-bold text-white tabular-nums shadow-sm
                  "
                >
                  {totalUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Aligned Color-Coded Sub-Navigation Bar Below Header on Inner Pages (< lg) */}
        {currentPage !== 'home' && !mobileMenuOpen && (
          <div className="lg:hidden bg-transparent">
            <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-1.5">
              <nav aria-label="Mobile quick navigation" className="w-full">
                <ResistiveFilterBar
                  surface="nav"
                  compact
                  ariaLabel="Mobile quick navigation"
                  value={currentPage}
                  onChange={(page) => handleMobileNavigate(page)}
                  options={mobileNavOptions}
                  className="w-full"
                />
              </nav>
            </div>
          </div>
        )}
      </motion.header>

      {/* In-Flow Spacer Matching Fixed Header Height on Inner Pages */}
      <div
        aria-hidden="true"
        className={
          currentPage !== 'home'
            ? 'h-[112px] lg:h-16 shrink-0'
            : 'h-0 shrink-0'
        }
      />

      {/* Portaled Burger Menu Backdrop + Clean GPU-Accelerated Dropdown Sheet */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-40 lg:hidden">
                {/* Blurred Background Overlay */}
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm will-change-[opacity] touch-none select-none"
                />

                {/* Fixed GPU-Composited Karst Boxy Outer Sheet with Clean Rounded Inner Cards */}
                <motion.div
                  id="mobile-nav-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Mobile navigation menu"
                  initial={{ opacity: 0, y: -8, scaleY: 0.96 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: -6, scaleY: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: 'top center' }}
                  className="fixed top-16 left-0 right-0 z-50 overflow-hidden border-b border-white/[0.16] bg-[#0d1017] shadow-2xl will-change-[transform,opacity]"
                >
                  <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-4 space-y-5 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain no-scrollbar touch-pan-y">
                    {/* Section 1: Portal Navigation Pages */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1 text-xs text-[#949ba8]">
                        <span className="font-semibold text-[#f5f4f0]">
                          Navigation
                        </span>
                        <span className="tabular-nums">
                          {mobileNavOptions.length} sections
                        </span>
                      </div>

                      <nav
                        aria-label="Mobile menu pages"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
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
                              onClick={() => handleMobileNavigate(option.value)}
                              className={`flex w-full min-h-[46px] items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.24]'
                                  : 'bg-[#121620] text-[#b4bac6] hover:text-[#f5f4f0] border border-white/[0.1]'
                              }`}
                            >
                              <span className="flex items-center gap-2.5 min-w-0">
                                <span className={`shrink-0 ${accentText}`}>
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
                                    Current
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </nav>
                    </div>

                    {/* Section 2: Appearance & Account */}
                    <div className="pt-4 border-t border-white/[0.12] space-y-3">
                      <div className="flex items-center justify-between px-1 text-xs text-[#949ba8]">
                        <div className="flex items-center gap-1.5 font-semibold text-[#f5f4f0]">
                          <Settings
                            className="h-3.5 w-3.5 text-[#3ddc97]"
                            aria-hidden="true"
                          />
                          <span>Appearance &amp; Account</span>
                        </div>
                        <span>
                          {theme === 'dark' ? 'Night Mode' : 'Daylight Mode'}
                        </span>
                      </div>

                      {/* Theme Toggle Control (Clean Plain Text) */}
                      <button
                        type="button"
                        onClick={onToggleTheme}
                        className="flex w-full min-h-[46px] items-center justify-between gap-2 rounded-xl border border-white/[0.14] bg-[#121620] px-4 py-2.5 text-xs font-semibold text-[#f5f4f0] hover:border-white/[0.28] transition-colors cursor-pointer"
                      >
                        <span className="text-[#b4bac6]">Portal Theme</span>
                        <span className="inline-flex items-center gap-2 text-[#f5f4f0]">
                          {theme === 'dark' ? (
                            <>
                              <Sun
                                className="h-4 w-4 text-[#facc15]"
                                aria-hidden="true"
                              />
                              <span>Switch to Light (Day)</span>
                            </>
                          ) : (
                            <>
                              <Moon
                                className="h-4 w-4 text-[#3ddc97]"
                                aria-hidden="true"
                              />
                              <span>Switch to Dark (Night)</span>
                            </>
                          )}
                        </span>
                      </button>

                      {/* Account & Identity Settings */}
                      {official ? (
                        <div className="rounded-xl border border-white/[0.14] bg-[#121620] p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <ShieldCheck
                                className="h-5 w-5 text-[#3ddc97] shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#f5f4f0] break-words">
                                  {official.name}
                                </p>
                                <p className="text-xs text-[#949ba8] break-words">
                                  {official.position}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-[#3ddc97] shrink-0">
                              Official
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              onSignOutOfficial();
                            }}
                            className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-red-500/35 bg-red-500/10 px-4 py-2 text-xs font-semibold text-[#fca5a5] hover:bg-red-500/20 transition-colors cursor-pointer"
                          >
                            <LogOut
                              className="h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      ) : student ? (
                        <div className="rounded-xl border border-white/[0.14] bg-[#121620] p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <GraduationCap
                                className="h-5 w-5 text-[#facc15] shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#f5f4f0] break-words">
                                  {student.name}
                                </p>
                                <p className="text-xs text-[#949ba8] break-words">
                                  {student.yearCourse || 'SLAC Student'}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-medium text-[#949ba8] shrink-0">
                              Student
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setMobileMenuOpen(false);
                                openIdentityEditor();
                              }}
                              className="inline-flex w-full min-h-[42px] items-center justify-center gap-1.5 rounded-full border border-white/[0.16] bg-[#181d29] px-3 py-2 text-xs font-semibold text-[#f5f4f0] hover:border-white/[0.28] transition-colors cursor-pointer"
                            >
                              <Edit3
                                className="h-3.5 w-3.5 text-[#3ddc97]"
                                aria-hidden="true"
                              />
                              <span>Edit Identity</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMobileMenuOpen(false);
                                onSignOutStudent();
                              }}
                              className="inline-flex w-full min-h-[42px] items-center justify-center gap-2 rounded-full border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-[#fca5a5] hover:bg-red-500/20 transition-colors cursor-pointer"
                            >
                              <LogOut
                                className="h-4 w-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Sign Out</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            onOpenAuth('student');
                          }}
                          className="gemini-cta inline-flex w-full min-h-[46px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-[0.08em] cursor-pointer"
                        >
                          <LogIn
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{siteConfig.header.primaryButtonText}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
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
                        className="min-h-[40px] px-4 py-2 rounded-full border border-white/[0.14] bg-[#181d29] text-xs font-medium text-[#b4bac6] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[40px] px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
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
