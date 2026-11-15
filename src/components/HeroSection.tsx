import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Megaphone,
  MessageSquare,
  Plus,
} from 'lucide-react';
import {
  AnnouncementItem,
  ForumThread,
  GalleryEventItem,
  PageRoute,
  siteConfig,
} from '../siteConfig';
import type { ThemeMode } from '../App';
import { HeroOffice3D } from './HeroOffice3D';
import { ScrollReveal } from './ScrollReveal';
import { WordRevealText } from './WordRevealText';

interface HeroSectionProps {
  announcements: AnnouncementItem[];
  events: GalleryEventItem[];
  forumThreads: ForumThread[];
  theme: ThemeMode;
  customLogoUrl?: string;
  isActive?: boolean;
  unreadCounts?: {
    announcements: number;
    events: number;
    forum: number;
  };
  onToggleTheme?: () => void;
  onNavigate: (page: PageRoute) => void;
}

/**
 * BODY SECTION 1: UNIFIED FULL-BLEED 3D COUNCIL OFFICE & SKY STAGE + KARST HIGHLIGHTS GRID
 * - The 3D Scene Stage (z-20) sits ABOVE the Campus Highlights body section (z-10) so the isometric
 *   3D office platform is never clipped or buried beneath the body.
 * - Both Mobile and PC use a true transparent glass-blur Hero text card (zero solid background color)
 *   positioned harmoniously inside the 3D scene stage.
 */
export function HeroSection({
  announcements,
  events,
  forumThreads,
  theme,
  customLogoUrl,
  isActive = true,
  unreadCounts,
  onToggleTheme,
  onNavigate,
}: HeroSectionProps) {
  const { eyebrow, headline, introduction, primaryCtaText, secondaryCtaText } =
    siteConfig.hero;

  const latestAnnouncement = announcements[0];
  const nextEvent = events[0];
  const latestThread = forumThreads[0];

  const annBadge = unreadCounts?.announcements ?? 0;
  const evtBadge = unreadCounts?.events ?? 0;
  const forumBadge = unreadCounts?.forum ?? 0;

  const isDark = theme === 'dark';

  // Day (Sunny Blue Sky) / Night (Starry Deep Sky) backdrop behind the transparent-alpha 3D WebGL stage
  const skyBackdropStyle = {
    background: isDark
      ? 'linear-gradient(180deg, #0b1120 0%, #111827 52%, #111312 100%)'
      : 'linear-gradient(180deg, #8ecaf9 0%, #d4ecff 52%, #f5f3ee 100%)',
  };

  // Subtle edge-to-transparent fading gradients (zero shapes/cards, keeping the 3D scene clearly visible)
  const mobileBottomFadeStyle = {
    background: isDark
      ? 'linear-gradient(0deg, rgba(17, 19, 18, 0.97) 0%, rgba(17, 19, 18, 0.82) 48%, rgba(17, 19, 18, 0) 100%)'
      : 'linear-gradient(0deg, rgba(250, 249, 246, 0.98) 0%, rgba(250, 249, 246, 0.84) 50%, rgba(250, 249, 246, 0) 100%)',
  };

  const desktopLeftFadeStyle = {
    background: isDark
      ? 'linear-gradient(90deg, rgba(17, 19, 18, 0.94) 0%, rgba(17, 19, 18, 0.7) 50%, rgba(17, 19, 18, 0) 100%)'
      : 'linear-gradient(90deg, rgba(250, 249, 246, 0.96) 0%, rgba(250, 249, 246, 0.72) 50%, rgba(250, 249, 246, 0) 100%)',
  };

  // Secondary CTA button without backdrop blur
  const secondaryButtonStyle = {
    backgroundColor: isDark
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(23, 24, 22, 0.09)',
    border: isDark
      ? '1px solid rgba(255, 255, 255, 0.22)'
      : '1px solid rgba(23, 24, 22, 0.18)',
  };

  return (
    <section
      id="top"
      aria-label="Smart Council introduction"
      className="relative w-full overflow-hidden border-b border-white/[0.14]"
    >
      {/* 1. UNIFIED FULL-BLEED 3D OFFICE & SKY STAGE (Positioned ABOVE the Body with z-20) */}
      <div
        id="hero-stage"
        style={skyBackdropStyle}
        className="relative z-20 w-full h-[650px] sm:h-[680px] lg:h-[690px] transition-colors duration-300"
      >
        {/* Full-Bleed Interactive 3D Isometric Office & Sky Canvas (z-10, transparent alpha) */}
        <div className="absolute inset-0 z-10">
          <HeroOffice3D
            theme={theme}
            customLogoUrl={customLogoUrl}
            isActive={isActive}
            onToggleTheme={onToggleTheme}
          />
        </div>

        {/* Pure Fading Gradient Backdrop (No card shapes, 3D scene stays clearly visible) */}
        <div
          aria-hidden="true"
          style={mobileBottomFadeStyle}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[64%] lg:hidden transition-colors duration-300"
        />
        <div
          aria-hidden="true"
          style={desktopLeftFadeStyle}
          className="pointer-events-none hidden lg:block absolute inset-y-0 left-0 z-20 w-[58%] transition-colors duration-300"
        />

        {/* Hero Text Content (Zero card shapes, borders, or blur):
            - Mobile (< lg): Sits in the lower portion while the 3D office is elevated clearly in the upper half.
            - Desktop (>= lg): Sits on the left while the 3D office is positioned clearly on the right. */}
        <div className="relative z-30 pointer-events-none mx-auto max-w-[1440px] h-full px-4 sm:px-8 lg:px-12 pt-16 pb-7 sm:pb-9 lg:py-20 flex items-end lg:items-center">
          <div className="pointer-events-auto w-full max-w-[445px] space-y-3.5 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span
                className={`uppercase tracking-[0.1em] font-bold ${
                  isDark ? 'text-[#f2a65a]' : 'text-[#b5483a]'
                }`}
              >
                {eyebrow}
              </span>
              <span
                className={`tabular-nums font-semibold ${
                  isDark ? 'text-[#e2e6ee]' : 'text-[#262825]'
                }`}
              >
                A.Y. 2025–2026
              </span>
            </div>

            <div>
              <WordRevealText
                as="h1"
                text={headline}
                className="font-bold tracking-[-0.025em] leading-[1.06] text-[#f5f4f0]"
                style={{ fontSize: 'clamp(1.85rem, 3.3vw, 3.05rem)' }}
                delay={0.05}
                y={22}
                stagger={0.07}
                highlightWords={['student', 'voice']}
                highlightClassName="text-[#3ddc97] hero-accent"
              />

              <p
                className={`mt-2.5 sm:mt-3 text-xs sm:text-base leading-relaxed font-medium ${
                  isDark ? 'text-[#e2e6ee]' : 'text-[#262825]'
                }`}
              >
                {introduction}
              </p>
            </div>

            <div className="pt-1 flex flex-row flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('announcements')}
                className="gemini-cta min-h-[40px] sm:min-h-[42px] px-4 sm:px-5 py-2 rounded-lg inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold active:scale-[0.99] transition-transform cursor-pointer"
              >
                <span>{primaryCtaText}</span>
                {annBadge > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[11px] font-bold text-white tabular-nums">
                    {annBadge}
                  </span>
                )}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('forum')}
                style={secondaryButtonStyle}
                className="min-h-[40px] sm:min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-[#f5f4f0] hover:opacity-90 inline-flex items-center justify-center gap-1.5 transition-opacity cursor-pointer shrink-0"
              >
                <span>{secondaryCtaText}</span>
                {forumThreads.length > 0 && (
                  <span className="text-xs opacity-75 tabular-nums">
                    ({forumThreads.length})
                  </span>
                )}
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KARST BOXY OUTLINED HIGHLIGHTS GRID (Positioned BELOW the 3D Scene Stage with z-10) */}
      <div className="relative z-10 mx-auto max-w-[1440px] border-x border-t border-white/[0.14] bg-[#121620]">
        {/* FULL-WIDTH BOXY SECTION TITLE BAR */}
        <div className="border-b border-white/[0.14] px-6 sm:px-10 lg:px-12 py-5 sm:py-6 flex flex-wrap items-baseline justify-between gap-4">
          <WordRevealText
            as="h2"
            text="Campus highlights"
            className="font-bold tracking-[-0.025em] text-[#f5f4f0]"
            style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.15rem)' }}
            y={20}
            stagger={0.08}
          />
        </div>

        {/* 3-COLUMN BOXY OUTLINED HIGHLIGHTS GRID WITH ROUNDED INNER CARDS & PLAIN TEXT METADATA */}
        <ScrollReveal delay={0.04}>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.14] bg-[#121620]">
            {/* Boxy Cell 1: Latest Advisory */}
            <button
              type="button"
              onClick={() => onNavigate('announcements')}
              className="group w-full rounded-none p-6 sm:p-8 text-left flex flex-col justify-between gap-5 bg-[#121620] hover:bg-[#181d29]/70 transition-colors cursor-pointer"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#3ddc97]">
                    <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Announcements</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {annBadge > 0 && (
                      <span className="text-xs font-semibold text-[#ef4444] tabular-nums">
                        {annBadge} new
                      </span>
                    )}
                    <ArrowUpRight
                      className="h-4 w-4 text-[#949ba8] group-hover:text-[#3ddc97] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {/* Rounded Inner Card Inside Boxy Cell */}
                <div className="card-elevated rounded-xl p-4 sm:p-5 space-y-1.5">
                  {latestAnnouncement?.category && (
                    <p className="text-xs font-medium text-[#949ba8]">
                      {latestAnnouncement.category}
                    </p>
                  )}
                  <p className="font-display text-base sm:text-lg font-bold text-[#f5f4f0] leading-snug line-clamp-2">
                    {latestAnnouncement?.title ?? 'No advisories published yet'}
                  </p>
                  <p className="text-xs sm:text-sm text-[#b4bac6] line-clamp-2 leading-relaxed">
                    {latestAnnouncement?.summary ??
                      'Latest memos and deadlines appear here.'}
                  </p>
                </div>
              </div>

              <div className="pt-3.5 border-t border-white/[0.1] flex items-center justify-between gap-3 text-xs text-[#949ba8] tabular-nums">
                <span>{latestAnnouncement?.date ?? 'Advisories'}</span>
                <span>{announcements.length} published</span>
              </div>
            </button>

            {/* Boxy Cell 2: Next Event */}
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className="group w-full rounded-none p-6 sm:p-8 text-left flex flex-col justify-between gap-5 bg-[#121620] hover:bg-[#181d29]/70 transition-colors cursor-pointer"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#f87171]">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Events</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {evtBadge > 0 && (
                      <span className="text-xs font-semibold text-[#e8985e] tabular-nums">
                        {evtBadge} new
                      </span>
                    )}
                    <ArrowUpRight
                      className="h-4 w-4 text-[#949ba8] group-hover:text-[#f87171] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {/* Rounded Inner Card Inside Boxy Cell */}
                <div className="card-elevated rounded-xl p-4 sm:p-5 space-y-1.5">
                  {nextEvent?.category && (
                    <p className="text-xs font-medium text-[#949ba8]">
                      {nextEvent.category}
                    </p>
                  )}
                  <p className="font-display text-base sm:text-lg font-bold text-[#f5f4f0] leading-snug line-clamp-2">
                    {nextEvent?.title ?? 'No upcoming events scheduled'}
                  </p>
                  <p className="text-xs sm:text-sm text-[#b4bac6] line-clamp-2 leading-relaxed">
                    {nextEvent?.description ??
                      'Schedules and venues for upcoming activities.'}
                  </p>
                </div>
              </div>

              <div className="pt-3.5 border-t border-white/[0.1] flex items-center justify-between gap-3 text-xs text-[#949ba8] tabular-nums">
                <span>{nextEvent?.date ?? 'Calendar'}</span>
                <span className="truncate max-w-[160px]">
                  {nextEvent?.location ?? `${events.length} scheduled`}
                </span>
              </div>
            </button>

            {/* Boxy Cell 3: Student Forum */}
            <button
              type="button"
              onClick={() => onNavigate('forum')}
              className="group w-full rounded-none p-6 sm:p-8 text-left flex flex-col justify-between gap-5 bg-[#121620] hover:bg-[#181d29]/70 transition-colors cursor-pointer"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#facc15]">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Student Forum</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {forumBadge > 0 && (
                      <span className="text-xs font-semibold text-[#ef4444] tabular-nums">
                        {forumBadge} new
                      </span>
                    )}
                    <ArrowUpRight
                      className="h-4 w-4 text-[#949ba8] group-hover:text-[#facc15] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {/* Rounded Inner Card Inside Boxy Cell */}
                <div className="card-elevated rounded-xl p-4 sm:p-5 space-y-1.5">
                  {latestThread?.topic && (
                    <p className="text-xs font-medium text-[#949ba8]">
                      {latestThread.topic}
                    </p>
                  )}
                  <p className="font-display text-base sm:text-lg font-bold text-[#f5f4f0] leading-snug line-clamp-2">
                    {latestThread?.title ?? 'Start a campus discussion'}
                  </p>
                  <p className="text-xs sm:text-sm text-[#b4bac6] line-clamp-2 leading-relaxed">
                    {latestThread?.body ??
                      'Share proposals, feedback, and questions with peers.'}
                  </p>
                </div>
              </div>

              <div className="pt-3.5 border-t border-white/[0.1] flex items-center justify-between gap-3 text-xs text-[#949ba8] tabular-nums">
                <span className="truncate font-medium text-[#f5f4f0]">
                  {latestThread?.author ?? 'Open Forum'}
                </span>
                <span>
                  {latestThread
                    ? `${latestThread.replies.length} ${
                        latestThread.replies.length === 1 ? 'reply' : 'replies'
                      }`
                    : `${forumThreads.length} threads`}
                </span>
              </div>
            </button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
