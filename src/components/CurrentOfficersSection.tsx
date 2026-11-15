import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { OfficerMember, OfficerTermRoster, PageRoute } from '../siteConfig';
import { ScrollReveal } from './ScrollReveal';
import {
  getImageFramingStyle,
  resolveImageUrl,
  stripImageFramingHash,
} from '../utils/imagekit';

interface CurrentOfficersSectionProps {
  officerTerms: OfficerTermRoster[];
  onNavigate: (page: PageRoute) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SSC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizeLoopX(value: number, halfWidth: number): number {
  if (halfWidth <= 0) return 0;
  let wrapped = value % halfWidth;
  if (wrapped > 0) wrapped -= halfWidth;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

const AUTO_GLIDE_PX_PER_SEC = 28;
const REDUCED_GLIDE_PX_PER_SEC = 14;

/**
 * HOME BODY SECTION: EXECUTIVE COUNCIL SHOWCASE
 */
export function CurrentOfficersSection({
  officerTerms,
  onNavigate,
}: CurrentOfficersSectionProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [rawFallbacks, setRawFallbacks] = useState<Record<string, boolean>>({});

  const [isOverflowing, setIsOverflowing] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstHalfRef = useRef<HTMLDivElement>(null);
  const halfWidthRef = useRef(0);
  const isOverflowingRef = useRef(false);
  const x = useMotionValue(0);

  const isDraggingRef = useRef(false);
  const isMouseHoveredRef = useRef(false);
  const isFocusPausedRef = useRef(false);
  const isInViewportRef = useRef(true);
  const didDragRef = useRef(false);
  const glideSpeedRef = useRef(AUTO_GLIDE_PX_PER_SEC);
  const flickVelocityRef = useRef(0);
  const resumeAtRef = useRef(0);
  const activeAnimRef = useRef<ReturnType<typeof animate> | null>(null);

  const pointerSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    lockedHorizontal: boolean;
  } | null>(null);

  const activeRoster = officerTerms.find((roster) =>
    roster.officers.some((m) => m.name.trim().length > 0)
  );
  const activeOfficers = (activeRoster?.officers ?? []).filter(
    (member) => member.name.trim().length > 0
  );
  const hasOfficers = Boolean(activeRoster && activeOfficers.length > 0);

  useEffect(() => {
    if (!hasOfficers) {
      isOverflowingRef.current = false;
      setIsOverflowing(false);
      x.set(0);
      return;
    }
    const node = firstHalfRef.current;
    const viewportNode = viewportRef.current;
    if (!node || !viewportNode) return;

    const updateWidth = () => {
      const w = node.getBoundingClientRect().width || node.offsetWidth;
      const computed = window.getComputedStyle(viewportNode);
      const padX =
        (parseFloat(computed.paddingLeft) || 0) +
        (parseFloat(computed.paddingRight) || 0);
      const innerViewportW = Math.max(0, viewportNode.clientWidth - padX);

      // Subtract trailing pr-3.5 (14px) when comparing against available boundary width
      const cardsNaturalWidth = Math.max(0, w - 14);
      const overflows =
        innerViewportW > 0 && cardsNaturalWidth > innerViewportW + 16;

      isOverflowingRef.current = overflows;
      setIsOverflowing((prev) => (prev === overflows ? prev : overflows));

      if (w > 0 && overflows) {
        halfWidthRef.current = w;
        x.set(normalizeLoopX(x.get(), w));
      } else {
        halfWidthRef.current = w;
        activeAnimRef.current?.stop();
        activeAnimRef.current = null;
        isDraggingRef.current = false;
        flickVelocityRef.current = 0;
        x.set(0);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    observer.observe(viewportNode);
    return () => observer.disconnect();
  }, [hasOfficers, activeRoster?.term, activeOfficers.length, x]);

  useEffect(() => {
    activeAnimRef.current?.stop();
    isDraggingRef.current = false;
    flickVelocityRef.current = 0;
    glideSpeedRef.current = AUTO_GLIDE_PX_PER_SEC;
    resumeAtRef.current = 0;
    x.set(0);
  }, [activeRoster?.term, x]);

  useEffect(() => {
    if (!hasOfficers || !isOverflowing) {
      x.set(0);
      return;
    }

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const targetSpeed = prefersReduced
      ? REDUCED_GLIDE_PX_PER_SEC
      : AUTO_GLIDE_PX_PER_SEC;

    let rafId = 0;
    let isRunning = false;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (!isRunning) return;
      if (!isOverflowingRef.current) {
        x.set(0);
        return;
      }
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      let half = halfWidthRef.current;
      if (half <= 0 && firstHalfRef.current) {
        half =
          firstHalfRef.current.getBoundingClientRect().width ||
          firstHalfRef.current.offsetWidth;
        if (half > 0) {
          halfWidthRef.current = half;
        }
      }

      if (half > 0 && !isDraggingRef.current && !activeAnimRef.current) {
        if (Math.abs(flickVelocityRef.current) > 8) {
          const next = normalizeLoopX(
            x.get() + flickVelocityRef.current * dt,
            half
          );
          x.set(next);
          flickVelocityRef.current *= Math.exp(-5.5 * dt);
          glideSpeedRef.current = 0;
          resumeAtRef.current = now + 260;
        } else if (
          !isMouseHoveredRef.current &&
          !isFocusPausedRef.current &&
          now >= resumeAtRef.current
        ) {
          flickVelocityRef.current = 0;
          glideSpeedRef.current +=
            (targetSpeed - glideSpeedRef.current) * (1 - Math.exp(-3.5 * dt));
          const next = normalizeLoopX(
            x.get() - glideSpeedRef.current * dt,
            half
          );
          x.set(next);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (
        isRunning ||
        document.hidden ||
        !isInViewportRef.current ||
        !isOverflowingRef.current
      )
        return;
      isRunning = true;
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (!isRunning) return;
      isRunning = false;
      window.cancelAnimationFrame(rafId);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    };

    let io: IntersectionObserver | null = null;
    if (sectionRef.current && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          isInViewportRef.current = entry.isIntersecting;
          if (entry.isIntersecting) {
            startLoop();
          } else {
            stopLoop();
          }
        },
        { threshold: 0.01 }
      );
      io.observe(sectionRef.current);
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    startLoop();

    return () => {
      stopLoop();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      activeAnimRef.current?.stop();
    };
  }, [hasOfficers, isOverflowing, x]);

  useEffect(() => {
    if (!hasOfficers || !isOverflowing) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!isOverflowingRef.current) return;
      const session = pointerSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const totalDx = e.clientX - session.startX;
      const totalDy = e.clientY - session.startY;

      if (!session.lockedHorizontal) {
        if (Math.abs(totalDx) < 10 && Math.abs(totalDy) < 10) return;
        if (Math.abs(totalDx) > Math.abs(totalDy) * 1.65) {
          session.lockedHorizontal = true;
          activeAnimRef.current?.stop();
          activeAnimRef.current = null;
          flickVelocityRef.current = 0;
          glideSpeedRef.current = 0;
          didDragRef.current = true;
          isDraggingRef.current = true;
        } else {
          pointerSessionRef.current = null;
          isDraggingRef.current = false;
          return;
        }
      }

      const now = performance.now();
      const dx = e.clientX - session.lastX;
      const dtMs = Math.max(4, now - session.lastTime);

      x.set(normalizeLoopX(x.get() + dx, halfWidthRef.current));

      const instantVel = (dx / dtMs) * 1000;
      flickVelocityRef.current =
        flickVelocityRef.current * 0.45 + instantVel * 0.55;

      session.lastX = e.clientX;
      session.lastTime = now;
    };

    const endPointerSession = (e: PointerEvent) => {
      const session = pointerSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const wasHorizontal = session.lockedHorizontal;
      pointerSessionRef.current = null;
      isDraggingRef.current = false;
      glideSpeedRef.current = 0;

      if (wasHorizontal) {
        flickVelocityRef.current = Math.max(
          -1400,
          Math.min(1400, flickVelocityRef.current)
        );
        resumeAtRef.current = performance.now() + 300;
      }

      window.setTimeout(() => {
        didDragRef.current = false;
      }, 60);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', endPointerSession);
    window.addEventListener('pointercancel', endPointerSession);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPointerSession);
      window.removeEventListener('pointercancel', endPointerSession);
    };
  }, [hasOfficers, isOverflowing, x]);

  const handleViewportPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isOverflowingRef.current) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.pointerType !== 'mouse') {
        isMouseHoveredRef.current = false;
      }

      didDragRef.current = false;
      // On desktop mouse, pause immediately on mousedown; on touch, wait until horizontal swipe is confirmed
      if (e.pointerType === 'mouse') {
        activeAnimRef.current?.stop();
        activeAnimRef.current = null;
        flickVelocityRef.current = 0;
        glideSpeedRef.current = 0;
        isDraggingRef.current = true;
      }

      pointerSessionRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastTime: performance.now(),
        lockedHorizontal: false,
      };
    },
    []
  );

  const animateGlideTo = (deltaX: number, duration = 0.36) => {
    if (!isOverflowingRef.current) return;
    const half = halfWidthRef.current;
    if (half <= 0) return;

    activeAnimRef.current?.stop();
    flickVelocityRef.current = 0;
    glideSpeedRef.current = 0;

    const start = x.get();
    const target = start + deltaX;

    activeAnimRef.current = animate(start, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        x.set(normalizeLoopX(latest, halfWidthRef.current));
      },
      onComplete: () => {
        activeAnimRef.current = null;
        resumeAtRef.current = performance.now() + 350;
      },
    });
  };

  const renderOfficerCard = (member: OfficerMember, keySuffix: string) => {
    const imgKey = `${member.id}:${member.image || ''}`;
    const transformedUrl = resolveImageUrl(
      member.image,
      'w-700,c-at_max,f-auto,q-85'
    );
    const rawUrl = stripImageFramingHash(member.image);
    const activeSrc = rawFallbacks[imgKey] ? rawUrl : transformedUrl;
    const showPhoto = Boolean(activeSrc) && !failedImages[imgKey];

    return (
      <div
        key={`${member.id}-${keySuffix}`}
        role="group"
        aria-label={`${member.name || 'Vacant'} — ${member.position}`}
        className="card-elevated group relative aspect-[3/4] w-[184px] sm:w-[206px] shrink-0 text-left rounded-xl overflow-hidden bg-[#0b0f18] select-none touch-pan-y"
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {showPhoto ? (
            <img
              src={activeSrc}
              alt={`${member.name} — ${member.position}`}
              loading="lazy"
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              onError={() => {
                if (!rawFallbacks[imgKey] && rawUrl && rawUrl !== activeSrc) {
                  setRawFallbacks((prev) => ({ ...prev, [imgKey]: true }));
                } else {
                  setFailedImages((prev) => ({
                    ...prev,
                    [imgKey]: true,
                  }));
                }
              }}
              style={getImageFramingStyle(member.image, 'portrait')}
              className="h-full w-full transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="-translate-y-5 text-xl font-bold text-[#3ddc97]">
              {getInitials(member.name)}
            </span>
          )}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%]"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgba(8, 11, 18, 0.98) 0%, rgba(8, 11, 18, 0.86) 28%, rgba(8, 11, 18, 0.44) 58%, rgba(8, 11, 18, 0.12) 82%, rgba(8, 11, 18, 0) 100%)',
          }}
        />

        <div className="photo-overlay absolute inset-x-0 bottom-0 p-3.5 sm:p-4 space-y-0.5 pointer-events-none">
          <p className="text-[11px] font-semibold text-[#3ddc97] truncate drop-shadow-sm">
            {member.position}
          </p>
          <p className="text-sm font-bold text-[#f5f4f0] truncate drop-shadow-sm">
            {member.name.trim() || 'Vacant'}
          </p>
        </div>
      </div>
    );
  };

  if (!activeRoster || activeOfficers.length === 0) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Current Supreme Student Council officers"
      className="relative w-full border-b border-white/[0.14]"
    >
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620]">
        <ScrollReveal>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-10 lg:px-12 py-5 sm:py-6 border-b border-white/[0.14] bg-[#0b0e15]">
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-[#3ddc97]" aria-hidden="true" />
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#f5f4f0]">
                  Meet the Council
                </h2>
              </div>

              <div className="flex items-center gap-1.5">
                {isOverflowing && (
                  <>
                    <button
                      type="button"
                      aria-label="Step officers left"
                      onClick={() => animateGlideTo(225)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-white/[0.14] bg-[#121620] text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.28] active:scale-95 transition-transform cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Step officers right"
                      onClick={() => animateGlideTo(-225)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-white/[0.14] bg-[#121620] text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.28] active:scale-95 transition-transform cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('officers')}
                  className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-[#facc15] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span className="hidden sm:inline">
                    Explore Past Councils
                  </span>
                  <span className="sm:hidden">Past Councils</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              ref={viewportRef}
              onDragStart={(e) => e.preventDefault()}
              onPointerDown={handleViewportPointerDown}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') {
                  isMouseHoveredRef.current = true;
                }
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') {
                  isMouseHoveredRef.current = false;
                }
              }}
              onFocusCapture={() => {
                isFocusPausedRef.current = true;
              }}
              onBlurCapture={() => {
                isFocusPausedRef.current = false;
              }}
              onWheel={(e) => {
                if (!isOverflowingRef.current) return;
                const delta =
                  Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : 0;
                if (delta !== 0) {
                  activeAnimRef.current?.stop();
                  activeAnimRef.current = null;
                  flickVelocityRef.current = 0;
                  glideSpeedRef.current = 0;
                  x.set(normalizeLoopX(x.get() - delta, halfWidthRef.current));
                  resumeAtRef.current = performance.now() + 450;
                }
              }}
              className={`overflow-hidden px-6 sm:px-10 lg:px-12 py-6 sm:py-8 touch-pan-y select-none ${
                isOverflowing
                  ? 'cursor-grab active:cursor-grabbing'
                  : 'cursor-default'
              }`}
            >
              <motion.div
                style={{ x: isOverflowing ? x : 0 }}
                className="flex w-max will-change-transform"
              >
                <div
                  ref={firstHalfRef}
                  className="flex items-stretch gap-3.5 pr-3.5"
                >
                  {activeOfficers.map((member) => renderOfficerCard(member, 'a'))}
                </div>
                {isOverflowing && (
                  <div
                    className="flex items-stretch gap-3.5 pr-3.5"
                    aria-hidden="true"
                  >
                    {activeOfficers.map((member) =>
                      renderOfficerCard(member, 'b')
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
