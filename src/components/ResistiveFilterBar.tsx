import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

export interface ResistiveFilterOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  tone?: 'green' | 'amber' | 'red' | 'yellow';
}

interface ResistiveFilterBarProps<T extends string = string> {
  options: Array<ResistiveFilterOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Optional variant matching card-nested vs page-level dark surfaces */
  surface?: 'page' | 'card' | 'nav';
  /** Compact height for dense card headers (e.g. Hero preview) */
  compact?: boolean;
  /** Optional className on outer frame */
  className?: string;
}

const SPRING_CONFIG = {
  stiffness: 380,
  damping: 30,
  mass: 0.42,
};

const MAX_DRAG_PX = 18;
const MAX_STRETCH_X = 0.032;

/**
 * Responsive, horizontally resistive filter & tab bar.
 * - Bounded frame keeps rounded corners/border intact on narrow mobile viewports.
 * - Dynamic CSS edge mask fades only overflowing sides (zero harsh mid-label clips).
 * - Spring-interpolated horizontal rubber-band resistance at left/right scroll boundaries.
 * - Container-scoped smooth centering on selection (never jumps outer page scroll).
 */
export function ResistiveFilterBar<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  surface = 'page',
  compact = false,
  className = '',
}: ResistiveFilterBarProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [fadeEdges, setFadeEdges] = useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  const rawX = useMotionValue(0);
  const rawScaleX = useMotionValue(1);
  const smoothX = useSpring(rawX, SPRING_CONFIG);
  const smoothScaleX = useSpring(rawScaleX, SPRING_CONFIG);

  const touchStartRef = useRef<{ x: number; y: number; lockedAxis: 'x' | 'y' | null } | null>(
    null
  );
  const wheelAccumRef = useRef(0);
  const wheelTimerRef = useRef<number | null>(null);
  const activeSideRef = useRef<'left' | 'right' | null>(null);

  const updateEdgeMasks = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 2) {
      setFadeEdges({ left: false, right: false });
      return;
    }
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft < maxScroll - 4;
    setFadeEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right }
    );
  }, []);

  useEffect(() => {
    updateEdgeMasks();
    const el = scrollerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => updateEdgeMasks());
    ro.observe(el);
    if (trackRef.current) ro.observe(trackRef.current);

    return () => {
      ro.disconnect();
    };
  }, [options, updateEdgeMasks]);

  const resetResistance = useCallback(() => {
    touchStartRef.current = null;
    if (activeSideRef.current === null) return;
    activeSideRef.current = null;
    wheelAccumRef.current = 0;
    rawX.set(0);
    rawScaleX.set(1);
  }, [rawScaleX, rawX]);

  const applyResistance = useCallback(
    (pullDelta: number, side: 'left' | 'right') => {
      const normalized = Math.min(1, Math.abs(pullDelta) / 140);
      const eased = 1 - Math.pow(1 - normalized, 2.1);
      const shift = (side === 'left' ? 1 : -1) * eased * MAX_DRAG_PX;
      const scale = 1 + eased * MAX_STRETCH_X;

      if (activeSideRef.current !== side && trackRef.current) {
        activeSideRef.current = side;
        trackRef.current.style.transformOrigin =
          side === 'left' ? '0% 50%' : '100% 50%';
      }

      rawX.set(shift);
      rawScaleX.set(scale);
    },
    [rawScaleX, rawX]
  );

  // Center active button inside this bar without touching outer page scroll
  const centerTab = useCallback((val: string, behavior: ScrollBehavior = 'smooth') => {
    const scroller = scrollerRef.current;
    const btn = btnRefs.current[val];
    if (!scroller || !btn) return;

    const targetLeft =
      btn.offsetLeft - (scroller.clientWidth - btn.offsetWidth) / 2;
    const clampedLeft = Math.max(
      0,
      Math.min(targetLeft, scroller.scrollWidth - scroller.clientWidth)
    );
    scroller.scrollTo({ left: clampedLeft, behavior });
  }, []);

  // Ensure initial active item (especially on nav bars) starts visible
  useEffect(() => {
    const scroller = scrollerRef.current;
    const btn = btnRefs.current[value];
    if (!scroller || !btn) return;
    const btnLeft = btn.offsetLeft;
    const btnRight = btnLeft + btn.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (btnLeft < viewLeft || btnRight > viewRight) {
      centerTab(value, 'auto');
    }
  }, [value, centerTab]);

  useEffect(() => {
    return () => {
      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      lockedAxis: null,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1 || !touchStartRef.current || !scrollerRef.current) {
      return;
    }

    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;

    if (!touchStartRef.current.lockedAxis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      touchStartRef.current.lockedAxis =
        Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }

    if (touchStartRef.current.lockedAxis !== 'x') return;

    const el = scrollerRef.current;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const atLeft = el.scrollLeft <= 1;
    const atRight = el.scrollLeft >= maxScroll - 1;

    if (dx > 0 && atLeft) {
      applyResistance(dx, 'left');
    } else if (dx < 0 && atRight) {
      applyResistance(dx, 'right');
    } else {
      if (activeSideRef.current !== null) {
        activeSideRef.current = null;
        rawX.set(0);
        rawScaleX.set(1);
      }
      touchStartRef.current.x = e.touches[0].clientX;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 1) return;

    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
    if (delta === 0) return;

    const atLeft = el.scrollLeft <= 1;
    const atRight = el.scrollLeft >= maxScroll - 1;

    if (delta < 0 && atLeft) {
      wheelAccumRef.current = Math.min(
        140,
        wheelAccumRef.current + Math.abs(delta) * 0.85
      );
      applyResistance(wheelAccumRef.current, 'left');
    } else if (delta > 0 && atRight) {
      wheelAccumRef.current = Math.min(
        140,
        wheelAccumRef.current + Math.abs(delta) * 0.85
      );
      applyResistance(wheelAccumRef.current, 'right');
    } else {
      if (activeSideRef.current !== null) {
        resetResistance();
      }
      return;
    }

    if (wheelTimerRef.current !== null) {
      window.clearTimeout(wheelTimerRef.current);
    }
    wheelTimerRef.current = window.setTimeout(resetResistance, 130);
  };

  const maskGradient =
    fadeEdges.left && fadeEdges.right
      ? 'linear-gradient(to right, transparent 0px, black 22px, black calc(100% - 22px), transparent 100%)'
      : fadeEdges.left
        ? 'linear-gradient(to right, transparent 0px, black 22px, black 100%)'
        : fadeEdges.right
          ? 'linear-gradient(to right, black 0px, black calc(100% - 22px), transparent 100%)'
          : undefined;

  const frameClass =
    surface === 'nav'
      ? 'inline-flex max-w-full rounded-xl bg-transparent'
      : surface === 'card'
        ? 'inline-flex max-w-full rounded-xl bg-[#0d1017]/85 border border-white/[0.08] overflow-hidden'
        : 'inline-flex max-w-full rounded-xl bg-[#121620] border border-white/[0.08] overflow-hidden';

  return (
    <div className={`${frameClass} ${className}`}>
      <div
        ref={scrollerRef}
        onScroll={updateEdgeMasks}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={resetResistance}
        onTouchCancel={resetResistance}
        onWheel={handleWheel}
        style={
          maskGradient
            ? {
                maskImage: maskGradient,
                WebkitMaskImage: maskGradient,
              }
            : undefined
        }
        className="w-full overflow-x-auto no-scrollbar overscroll-x-contain touch-pan-x snap-x snap-proximity"
      >
        <motion.div
          ref={trackRef}
          role={surface === 'nav' ? undefined : 'tablist'}
          aria-label={ariaLabel}
          style={{ x: smoothX, scaleX: smoothScaleX }}
          className={`inline-flex items-center gap-1 ${
            surface === 'nav' ? 'p-0.5' : 'p-1'
          } will-change-transform`}
        >
          {options.map((opt) => {
            const active = value === opt.value;
            const navActiveToneClass =
              opt.tone === 'amber'
                ? 'bg-[#e8985e]/15 border-[#e8985e]/50 text-[#e8985e]'
                : opt.tone === 'red'
                  ? 'bg-[#ef4444]/15 border-[#ef4444]/45 text-[#f87171]'
                  : opt.tone === 'yellow'
                    ? 'bg-[#facc15]/15 border-[#facc15]/45 text-[#facc15]'
                    : 'bg-[#3ddc97]/15 border-[#3ddc97]/40 text-[#3ddc97]';

            const buttonClass =
              surface === 'nav'
                ? `inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3ddc97] whitespace-nowrap shrink-0 snap-center cursor-pointer ${
                    active
                      ? navActiveToneClass
                      : 'bg-[#121620] border-white/[0.1] text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.2]'
                  }`
                : `${
                    compact
                      ? 'min-h-[34px] px-3 py-1 text-xs'
                      : 'min-h-[38px] px-3.5 py-1.5 text-xs sm:text-[13px]'
                  } inline-flex items-center gap-1.5 font-semibold rounded-lg transition-all duration-150 active:scale-[0.95] whitespace-nowrap shrink-0 snap-center tabular-nums cursor-pointer ${
                    active
                      ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.22] shadow-xs'
                      : 'text-[#b4bac6] hover:text-[#f5f4f0]'
                  }`;

            return (
              <button
                key={opt.value}
                ref={(node) => {
                  btnRefs.current[opt.value] = node;
                }}
                type="button"
                role={surface === 'nav' ? undefined : 'tab'}
                aria-selected={surface === 'nav' ? undefined : active}
                aria-current={surface === 'nav' && active ? 'page' : undefined}
                onClick={() => {
                  onChange(opt.value);
                  centerTab(opt.value, 'smooth');
                }}
                className={buttonClass}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
