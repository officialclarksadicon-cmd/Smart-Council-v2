import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  OfficerCommittee,
  OfficerMember,
  OfficerTermRoster,
  OfficialProfile,
  PageRoute,
} from '../siteConfig';
import { PageSubNav } from '../components/PageSubNav';
import { ResistiveFilterBar } from '../components/ResistiveFilterBar';
import { ScrollReveal } from '../components/ScrollReveal';
import { WordRevealText } from '../components/WordRevealText';
import {
  getImageFramingStyle,
  resolveImageUrl,
  stripImageFramingHash,
} from '../utils/imagekit';

interface OfficersPageProps {
  terms: OfficerTermRoster[];
  official: OfficialProfile | null;
  onNavigate: (page: PageRoute) => void;
}

const COMMITTEE_ORDER: OfficerCommittee[] = [
  'Executive Board',
  'Year Level Representatives',
  'Information',
  'Documentary',
  'Technical',
];

const COMMITTEE_ACCENT: Record<
  OfficerCommittee,
  { text: string; bar: string; monogramBg: string }
> = {
  'Executive Board': {
    text: 'text-[#3ddc97]',
    bar: '#3ddc97',
    monogramBg:
      'radial-gradient(circle at 30% 25%, rgba(61, 220, 151, 0.22), rgba(18, 22, 32, 0.96) 72%)',
  },
  'Year Level Representatives': {
    text: 'text-[#facc15]',
    bar: '#facc15',
    monogramBg:
      'radial-gradient(circle at 30% 25%, rgba(250, 204, 21, 0.18), rgba(18, 22, 32, 0.96) 72%)',
  },
  Information: {
    text: 'text-[#38bdf8]',
    bar: '#38bdf8',
    monogramBg:
      'radial-gradient(circle at 30% 25%, rgba(56, 189, 248, 0.20), rgba(18, 22, 32, 0.96) 72%)',
  },
  Documentary: {
    text: 'text-[#f87171]',
    bar: '#ef4444',
    monogramBg:
      'radial-gradient(circle at 30% 25%, rgba(239, 68, 68, 0.18), rgba(18, 22, 32, 0.96) 72%)',
  },
  Technical: {
    text: 'text-[#3ddc97]',
    bar: '#22c55e',
    monogramBg:
      'radial-gradient(circle at 30% 25%, rgba(34, 197, 94, 0.20), rgba(18, 22, 32, 0.96) 72%)',
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SSC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface OfficerCommitteeRowProps {
  committee: OfficerCommittee;
  termLabel: string;
  members: OfficerMember[];
  failedImages: Record<string, boolean>;
  rawFallbacks: Record<string, boolean>;
  onImageError: (imgKey: string, hasRawFallback: boolean) => void;
  onSelectOfficer: (member: OfficerMember) => void;
}

function OfficerCommitteeRow({
  committee,
  termLabel,
  members,
  failedImages,
  rawFallbacks,
  onImageError,
  onSelectOfficer,
}: OfficerCommitteeRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const theme = COMMITTEE_ACCENT[committee];

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;

    const checkOverflow = () => {
      const overflows = node.scrollWidth > node.clientWidth + 16;
      setCanScroll((prev) => (prev === overflows ? prev : overflows));
      if (!overflows && node.scrollLeft !== 0) {
        node.scrollLeft = 0;
      }
    };

    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(node);
    return () => ro.disconnect();
  }, [members.length]);

  const scrollTrack = (direction: 'left' | 'right') => {
    const node = trackRef.current;
    if (!node || !canScroll) return;
    const distance = direction === 'left' ? -280 : 280;
    node.scrollBy({ left: distance, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      <ScrollReveal>
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.14]">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#f5f4f0]">
              {committee}
            </h2>
            <span className="text-xs font-medium text-[#949ba8] tabular-nums">
              ({members.length})
            </span>
          </div>

          {canScroll && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-label={`Scroll ${committee} left`}
                onClick={() => scrollTrack('left')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-white/[0.14] bg-[#0b0e15] text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.28] active:scale-95 transition-transform cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Scroll ${committee} right`}
                onClick={() => scrollTrack('right')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-white/[0.14] bg-[#0b0e15] text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.28] active:scale-95 transition-transform cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <div
          ref={trackRef}
          className={`flex items-stretch gap-4 sm:gap-5 no-scrollbar pb-2 ${
            canScroll
              ? 'overflow-x-auto snap-x snap-mandatory touch-pan-x'
              : 'overflow-x-hidden touch-pan-y'
          }`}
        >
          {members.map((member) => {
            const imgKey = `${member.id}:${member.image || ''}`;
            const transformedUrl = resolveImageUrl(
              member.image,
              'w-700,c-at_max,f-auto,q-85'
            );
            const rawUrl = stripImageFramingHash(member.image);
            const activeSrc = rawFallbacks[imgKey] ? rawUrl : transformedUrl;
            const showPhoto = Boolean(activeSrc) && !failedImages[imgKey];

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectOfficer(member)}
                className="card-elevated group relative aspect-[3/4] w-[215px] sm:w-[240px] shrink-0 snap-start text-left rounded-2xl overflow-hidden bg-[#0b0f18] cursor-pointer"
              >
                <div
                  className="h-[2px] w-full absolute top-0 inset-x-0 z-20"
                  style={{ backgroundColor: theme.bar }}
                  aria-hidden="true"
                />

                <div
                  className="absolute inset-0 flex items-center justify-center bg-[#0d1017]"
                  style={{
                    backgroundImage: showPhoto ? undefined : theme.monogramBg,
                  }}
                >
                  {showPhoto ? (
                    <img
                      src={activeSrc}
                      alt={`${member.name} — ${member.position}`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        onImageError(
                          imgKey,
                          Boolean(!rawFallbacks[imgKey] && rawUrl && rawUrl !== activeSrc)
                        )
                      }
                      style={getImageFramingStyle(member.image, 'portrait')}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="photo-overlay -translate-y-6 flex flex-col items-center justify-center gap-2 select-none">
                      <div className="h-16 w-16 rounded-2xl border border-white/[0.14] bg-[#0b0e15]/80 flex items-center justify-center shadow-inner">
                        <span
                          className={`text-xl font-bold tracking-tight ${theme.text}`}
                        >
                          {getInitials(member.name)}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[#949ba8]">
                        Term {termLabel}
                      </span>
                    </div>
                  )}
                </div>

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[56%] z-10"
                  style={{
                    backgroundImage:
                      'linear-gradient(to top, rgba(8, 11, 18, 0.98) 0%, rgba(8, 11, 18, 0.86) 28%, rgba(8, 11, 18, 0.44) 58%, rgba(8, 11, 18, 0.12) 82%, rgba(8, 11, 18, 0) 100%)',
                  }}
                />

                <div className="photo-overlay absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
                    <span
                      className={`font-semibold truncate drop-shadow-sm ${theme.text}`}
                    >
                      {member.optional
                        ? `${member.position} (Optional)`
                        : member.position}
                    </span>
                    <span className="text-[#b4bac6] tabular-nums shrink-0 drop-shadow-sm">
                      {termLabel}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#f5f4f0] truncate drop-shadow-sm">
                    {member.name.trim() || 'Vacant'}
                  </h3>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollReveal>
    </div>
  );
}

export function OfficersPage({
  terms,
  official,
  onNavigate,
}: OfficersPageProps) {
  const validTerms = terms.filter(
    (roster) =>
      roster.term.trim().length > 0 &&
      roster.officers.some((m) => m.name.trim().length > 0)
  );

  const [selectedTerm, setSelectedTerm] = useState<string>(
    validTerms[0]?.term ?? ''
  );
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerMember | null>(
    null
  );
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [rawFallbacks, setRawFallbacks] = useState<Record<string, boolean>>({});

  const activeRoster =
    validTerms.find((t) => t.term === selectedTerm) ?? validTerms[0];

  useEffect(() => {
    if (!selectedOfficer) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedOfficer(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedOfficer]);

  const filledOfficers = (activeRoster?.officers ?? []).filter(
    (member) => member.name.trim().length > 0
  );

  const handleImageError = (imgKey: string, canUseRaw: boolean) => {
    if (canUseRaw) {
      setRawFallbacks((prev) => ({ ...prev, [imgKey]: true }));
    } else {
      setFailedImages((prev) => ({ ...prev, [imgKey]: true }));
    }
  };

  return (
    <section className="w-full border-b border-white/[0.14]">
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620] px-4 sm:px-8 lg:px-12 py-6 lg:py-8">
        <PageSubNav currentPage="officers" onNavigate={onNavigate} />

        {/* Page Header */}
        <ScrollReveal className="pb-6 border-b border-white/[0.14] flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <WordRevealText
              as="h1"
              text="Council Officers Archive"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f5f4f0]"
              y={32}
              stagger={0.1}
              highlightWords={['Officers', 'Archive']}
            />
            <p className="mt-2 text-sm sm:text-base text-[#b4bac6] max-w-xl leading-relaxed">
              Browse Supreme Student Council leadership across published academic terms.
            </p>
          </div>

          {official && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-full border border-white/[0.16] bg-[#0b0e15] text-[#f5f4f0] hover:bg-[#181d29] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LayoutDashboard
                className="h-4 w-4 text-[#3ddc97]"
                aria-hidden="true"
              />
              <span>Manage Officers in Admin</span>
            </button>
          )}
        </ScrollReveal>

        {validTerms.length === 0 || filledOfficers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/[0.12] bg-[#0b0e15] p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base font-semibold text-[#f5f4f0]">
              No council officer entries published yet
            </p>
            <p className="mt-1 text-xs sm:text-sm text-[#b4bac6]">
              {official
                ? 'Open the Admin Dashboard to add a custom term timeline and publish council officers.'
                : 'Council terms and officer rosters will appear here once published by the SSC.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 pb-5 border-b border-white/[0.14]">
              <ResistiveFilterBar
                ariaLabel="Select council term"
                value={activeRoster?.term ?? selectedTerm}
                onChange={setSelectedTerm}
                options={validTerms.map((roster) => ({
                  value: roster.term,
                  label: roster.term,
                }))}
              />
            </div>

            <div className="mt-8 space-y-10">
              {COMMITTEE_ORDER.map((committee) => {
                const members = filledOfficers.filter(
                  (m) => m.committee === committee
                );
                if (members.length === 0 || !activeRoster) return null;

                return (
                  <OfficerCommitteeRow
                    key={`${activeRoster.term}-${committee}`}
                    committee={committee}
                    termLabel={activeRoster.term}
                    members={members}
                    failedImages={failedImages}
                    rawFallbacks={rawFallbacks}
                    onImageError={handleImageError}
                    onSelectOfficer={setSelectedOfficer}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Officer Lightbox Detail Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedOfficer && activeRoster && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="officer-modal-name"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => setSelectedOfficer(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#121620] border border-white/[0.12] shadow-2xl"
                >
                  {(() => {
                    const modalKey = `${selectedOfficer.id}:${selectedOfficer.image || ''}`;
                    const modalUrl = rawFallbacks[modalKey]
                      ? stripImageFramingHash(selectedOfficer.image)
                      : resolveImageUrl(
                          selectedOfficer.image,
                          'w-900,c-at_max,f-auto,q-85'
                        );
                    const hasModalPhoto =
                      Boolean(modalUrl) && !failedImages[modalKey];

                    return (
                      <div
                        className="relative aspect-[3/4] max-h-[360px] w-full flex items-center justify-center bg-[#0d1017] overflow-hidden"
                        style={{
                          backgroundImage: hasModalPhoto
                            ? undefined
                            : COMMITTEE_ACCENT[selectedOfficer.committee]
                                .monogramBg,
                        }}
                      >
                        {hasModalPhoto ? (
                          <img
                            src={modalUrl}
                            alt={`${selectedOfficer.name} — ${selectedOfficer.position}`}
                            referrerPolicy="no-referrer"
                            style={getImageFramingStyle(
                              selectedOfficer.image,
                              'portrait'
                            )}
                            className="h-full w-full"
                          />
                        ) : (
                          <div className="h-24 w-24 rounded-2xl border border-white/[0.16] bg-[#0b0e15]/85 flex items-center justify-center">
                            <span
                              className={`text-3xl font-bold ${
                                COMMITTEE_ACCENT[selectedOfficer.committee].text
                              }`}
                            >
                              {getInitials(selectedOfficer.name)}
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          aria-label="Close officer detail"
                          onClick={() => setSelectedOfficer(null)}
                          className="absolute top-3 right-3 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#0b0e15] border border-white/[0.16] text-[#f5f4f0] hover:bg-[#181d29] cursor-pointer"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    );
                  })()}

                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span
                        className={`font-semibold ${
                          COMMITTEE_ACCENT[selectedOfficer.committee].text
                        }`}
                      >
                        {selectedOfficer.committee}
                      </span>
                      <span className="text-[#b4bac6] tabular-nums">
                        Term {activeRoster.term}
                      </span>
                    </div>

                    <h2
                      id="officer-modal-name"
                      className="text-xl font-bold text-[#f5f4f0]"
                    >
                      {selectedOfficer.name.trim() || 'Vacant Position'}
                    </h2>

                    <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-sm text-[#b4bac6]">
                      <span className="inline-flex items-center gap-2 text-[#f5f4f0] font-medium">
                        <ShieldCheck
                          className="h-4 w-4 text-[#3ddc97]"
                          aria-hidden="true"
                        />
                        {selectedOfficer.optional
                          ? `${selectedOfficer.position} (Optional)`
                          : selectedOfficer.position}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#949ba8]">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        SLAC SSC
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
