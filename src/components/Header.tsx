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
  MessageSquare,
  Moon,
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
  const [pressedItem, setPressedItem] = useState<string | null>(null);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [isFilled, setIsFilled] = useState(false);

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

  // Track scroll position with a passive scroll listener:
  // - When scrolling down OR up (scrollY > 8), the header is 100% opaque (.karst-header-solid)
  // - Only when settled at the very top (scrollY <= 8) does it return to glassmorphism (.karst-header-glass)
  useEffect(() => {
    const TOP_THRESHOLD = 8;

    const updateHeaderState = () => {
      scrollTickingRef.current = false;
      const currentScrollY = Math.max(
        0,
        window.scrollY || document.documentElement.scrollTop || 0
      );
      setIsFilled(currentScrollY > TOP_THRESHOLD);
    };

    const handleScroll = () => {
      if (!scrollTickingRef.current) {
        scrollTickingRef.current = true;
        window.requestAnimationFrame(updateHeaderState);
      }
    };

    updateHeaderState();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [currentPage]);

  // Lock background page scroll & listen for Escape when Menu Overlay is open
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
    setPressedItem(null);
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

  // State-dependent blurred glass:
  // - Top of Hero section (currentPage === 'home' && !isFilled && !menuDrawerOpen): .karst-header-glass
  // - Scrolled, menu open, or on any inner section page: .karst-header-solid
  const isSectionState = isFilled || currentPage !== 'home' || menuDrawerOpen;
  const headerFillClass = isSectionState
    ? 'karst-header-solid'
    : 'karst-header-glass';

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[95] w-full translate-y-0 border-b ${headerFillClass}`}
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1 (Left): Smart Council Wordmark (Logo) */}
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

          {/* Zone 2 (Center): Desktop Navigation Bar with Mavi-Style Pill Hover/Pressed Feedback */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center justify-center gap-1.5 xl:gap-2 shrink-0"
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
                  onClick={() => handleNavigateSelect(item.page)}
                  className={`mavi-desktop-nav-btn shrink-0 ${
                    isActive ? 'is-active' : ''
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
                      className={`absolute left-2.5 right-2.5 bottom-1 h-[2px] rounded-full ${indicatorColor}`}
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
                onClick={() => handleNavigateSelect('admin')}
                className="mavi-desktop-nav-btn shrink-0"
              >
                <LayoutDashboard
                  className="h-3.5 w-3.5 text-[#3ddc97]"
                  aria-hidden="true"
                />
                <span>SSC Suite</span>
              </button>
            )}
          </nav>

          {/* Zone 3 (Right): Primary Sign-In Action + Connected Cog Burger-to-X Button */}
          <div className="shrink-0 flex items-center justify-end gap-2.5">
            {!official && !student && (
              <button
                type="button"
                aria-label="Sign in as Student or SSC Official"
                onClick={() => {
                  setMenuDrawerOpen(false);
                  onOpenAuth('student');
                }}
                className="hidden sm:inline-flex items-center justify-center gap-1.5 h-[42px] px-4 text-xs font-semibold rounded-xl border border-white/[0.16] bg-[#121620] text-[#f5f4f0] hover:border-white/[0.28] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5 text-[#3ddc97]" aria-hidden="true" />
                <span>{siteConfig.header.primaryButtonText}</span>
              </button>
            )}

            {/* Single Connected Mavi Design Hamburger-to-X Trigger (Rotates like a cog open & close) */}
            <button
              type="button"
              aria-label={
                menuDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'
              }
              aria-expanded={menuDrawerOpen}
              aria-controls="mavi-navigation-overlay"
              onClick={() => setMenuDrawerOpen((prev) => !prev)}
              className={`relative mavi-burger-btn shrink-0 ${
                menuDrawerOpen ? 'is-open' : ''
              }`}
            >
              <div
                aria-hidden="true"
                className={`designcouch-burger ${menuDrawerOpen ? 'open' : ''}`}
              >
                <span />
                <span />
                <span />
              </div>
              {!menuDrawerOpen && totalUnread > 0 && (
                <span
                  aria-label={`${totalUnread} new notifications`}
                  className="absolute -top-1 -right-1 inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white tabular-nums shadow-sm"
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
        <div className="lg:hidden w-full border-b border-white/[0.14] bg-[#121620]">
          <div className="mx-auto w-full max-w-[1440px] border-x border-white/[0.14] px-4 sm:px-8 py-3">
            <div className="rounded-2xl border border-white/[0.12] bg-[#0b0e15] p-1.5">
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
        </div>
      )}

      {/* Portaled Mavi Design Navigation Overlay (Mobile Top-Down Slide + Desktop Top-Right Popover) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {menuDrawerOpen && (
              <div
                id="mavi-navigation-overlay"
                role="dialog"
                aria-modal="true"
                aria-label="Site navigation and account menu"
                className="fixed inset-0 z-[80] overflow-hidden"
              >
                {/* Dimmed Backdrop Overlay */}
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setMenuDrawerOpen(false)}
                  className="fixed inset-0 bg-black/45 lg:bg-black/25 backdrop-blur-[2px] touch-none select-none"
                />

                {/* ============================================================
                    1. MOBILE VIEW (< lg): Mavi Design Top-Entering Menu Panel
                    Slides down from the top (y: '-100%' -> '0%') in lockstep with
                    the 420ms cog-turning burger-to-X icon in the top header bar.
                    ============================================================ */}
                <motion.aside
                  initial={{ y: '-100%' }}
                  animate={{ y: '0%' }}
                  exit={{ y: '-100%' }}
                  transition={{
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="lg:hidden fixed top-0 left-0 right-0 z-[85] pt-16 max-h-[100dvh] overflow-y-auto overscroll-contain no-scrollbar border-b rounded-b-3xl mavi-menu-surface flex flex-col will-change-transform"
                >
                  {/* Centered Mavi Design Menu Button Stack */}
                  <nav
                    aria-label="Mobile navigation menu"
                    className="px-5 pt-5 pb-4 flex flex-col items-center space-y-1.5"
                  >
                    {mobileNavOptions.map((option) => {
                      const isActive = currentPage === option.value;
                      const isPressed = pressedItem === `mobile-${option.value}`;
                      const labelText =
                        option.value === 'home' ? 'Homepage' : option.rawLabel;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-current={isActive ? 'page' : undefined}
                          onPointerDown={() =>
                            setPressedItem(`mobile-${option.value}`)
                          }
                          onPointerUp={() => setPressedItem(null)}
                          onPointerLeave={() => setPressedItem(null)}
                          onClick={() => handleNavigateSelect(option.value)}
                          className={`mavi-menu-btn ${
                            isActive ? 'is-active' : ''
                          } ${isPressed ? 'is-pressed' : ''}`}
                        >
                          <span>{labelText}</span>
                          {option.badgeCount > 0 && (
                            <span
                              aria-label={`${option.badgeCount} new`}
                              className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[11px] font-mono font-bold text-white leading-none tabular-nums"
                            >
                              {option.badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>

                  {/* Bottom Account & Theme Utility Actions (Mavi Button Geometry) */}
                  <div className="px-5 pt-3 pb-6 border-t border-white/[0.12] flex flex-col items-center space-y-1.5">
                    {official ? (
                      <>
                        <div className="w-full py-1.5 text-center">
                          <p className="text-xs font-bold text-[#f5f4f0] truncate">
                            {official.name}
                          </p>
                          <p className="text-[11px] text-[#949ba8] truncate">
                            {official.position}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleNavigateSelect('admin')}
                          className="mavi-menu-btn text-[15px]"
                        >
                          <span>My Account (SSC Suite)</span>
                        </button>
                      </>
                    ) : student ? (
                      <>
                        <div className="w-full py-1.5 text-center">
                          <p className="text-xs font-bold text-[#f5f4f0] truncate">
                            {student.name}
                          </p>
                          <p className="text-[11px] text-[#949ba8] truncate">
                            {student.yearCourse || 'SLAC Student'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuDrawerOpen(false);
                            openIdentityEditor();
                          }}
                          className="mavi-menu-btn text-[15px]"
                        >
                          <span>My Account Settings</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuDrawerOpen(false);
                          onOpenAuth('student');
                        }}
                        className="mavi-menu-btn text-[15px]"
                      >
                        <span>Sign In (Student / Official)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onToggleTheme}
                      className="mavi-menu-btn text-[15px] gap-2"
                    >
                      <span>
                        Appearance: {theme === 'dark' ? 'Dark' : 'Light'}
                      </span>
                      {theme === 'dark' ? (
                        <Sun className="h-4 w-4 text-[#facc15]" aria-hidden="true" />
                      ) : (
                        <Moon className="h-4 w-4 text-[#3ddc97]" aria-hidden="true" />
                      )}
                    </button>

                    {(official || student) && (
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
                        className="mavi-menu-btn text-[15px] !text-[#f87171]"
                      >
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                </motion.aside>

                {/* ============================================================
                    2. DESKTOP VIEW (>= lg): Top-Right Anchored Mavi Overlay Card
                    Positioned directly below the top-right burger/X button.
                    Slides down in sync with the turning cog icon.
                    ============================================================ */}
                <motion.aside
                  initial={{ opacity: 0, y: -28, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -24, scale: 0.96 }}
                  transition={{
                    duration: 0.38,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ transformOrigin: 'top right' }}
                  className="hidden lg:flex fixed top-[74px] right-[max(2rem,calc((100vw-1440px)/2+2rem))] z-[85] w-[320px] max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain no-scrollbar rounded-2xl border mavi-menu-surface flex-col p-3.5 will-change-transform"
                >
                  {/* Account Identity Header Card */}
                  <div className="mb-2.5 rounded-xl border border-white/[0.12] bg-[#0b0e15] p-3">
                    {official ? (
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck
                              className="h-3.5 w-3.5 text-[#3ddc97] shrink-0"
                              aria-hidden="true"
                            />
                            <p className="text-xs font-bold text-[#f5f4f0] truncate">
                              {official.name}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#949ba8] truncate">
                            {official.position}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleNavigateSelect('admin')}
                          className="shrink-0 h-8 px-2.5 rounded-lg bg-[#121620] border border-white/[0.14] text-[11px] font-semibold text-[#f5f4f0] hover:border-white/[0.28] transition-colors cursor-pointer"
                        >
                          SSC Suite
                        </button>
                      </div>
                    ) : student ? (
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <GraduationCap
                              className="h-3.5 w-3.5 text-[#3ddc97] shrink-0"
                              aria-hidden="true"
                            />
                            <p className="text-xs font-bold text-[#f5f4f0] truncate">
                              {student.name}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#949ba8] truncate">
                            {student.yearCourse || 'SLAC Student'}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Edit student identity"
                          onClick={() => {
                            setMenuDrawerOpen(false);
                            openIdentityEditor();
                          }}
                          className="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-[#121620] border border-white/[0.14] text-[11px] font-semibold text-[#f5f4f0] hover:border-white/[0.28] transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#f5f4f0]">
                            Portal Account
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#949ba8]">
                            Sign in as Student or Official
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuDrawerOpen(false);
                            onOpenAuth('student');
                          }}
                          className="gemini-cta shrink-0 h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Sign In</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Mavi Design Centered Menu Buttons for Desktop Quick-Jump */}
                  <nav
                    aria-label="Desktop quick navigation menu"
                    className="flex flex-col items-center space-y-1 py-1"
                  >
                    {mobileNavOptions.map((option) => {
                      const isActive = currentPage === option.value;
                      const isPressed = pressedItem === `desktop-${option.value}`;
                      const labelText =
                        option.value === 'home' ? 'Homepage' : option.rawLabel;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-current={isActive ? 'page' : undefined}
                          onPointerDown={() =>
                            setPressedItem(`desktop-${option.value}`)
                          }
                          onPointerUp={() => setPressedItem(null)}
                          onPointerLeave={() => setPressedItem(null)}
                          onClick={() => handleNavigateSelect(option.value)}
                          className={`mavi-menu-btn !min-h-[44px] !text-[15px] ${
                            isActive ? 'is-active' : ''
                          } ${isPressed ? 'is-pressed' : ''}`}
                        >
                          <span>{labelText}</span>
                          {option.badgeCount > 0 && (
                            <span
                              aria-label={`${option.badgeCount} new`}
                              className="ml-2 inline-flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-mono font-bold text-white leading-none tabular-nums"
                            >
                              {option.badgeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>

                  {/* Bottom Desktop Utility Footer (Theme Toggle + Sign Out) */}
                  <div className="mt-2.5 pt-2.5 border-t border-white/[0.12] flex flex-col space-y-1">
                    <button
                      type="button"
                      onClick={onToggleTheme}
                      className="mavi-menu-btn !min-h-[42px] !text-[14px] gap-2"
                    >
                      <span>
                        Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </span>
                      {theme === 'dark' ? (
                        <Sun className="h-4 w-4 text-[#facc15]" aria-hidden="true" />
                      ) : (
                        <Moon className="h-4 w-4 text-[#3ddc97]" aria-hidden="true" />
                      )}
                    </button>

                    {(official || student) && (
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
                        className="mavi-menu-btn !min-h-[42px] !text-[14px] !text-[#f87171] gap-1.5"
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
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
