import { ReactNode, useEffect, useRef, useState } from 'react';

interface EdgeStretchShellProps {
  children: ReactNode;
  isRefreshing?: boolean;
  onPullRefresh?: () => void;
}

const PULL_REFRESH_THRESHOLD = 76;

/**
 * Lightweight wrapper with Google-style Mobile Pull-to-Refresh circular spinner
 * when pulling down from the top of the page on touch devices.
 * Avoids applying full-document scaleY/will-change-transform layers so page transitions
 * (such as Home <-> Admin) never experience GPU texture reallocation blackouts or scroll stutter.
 */
export function EdgeStretchShell({
  children,
  isRefreshing = false,
  onPullRefresh,
}: EdgeStretchShellProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const pullDistanceRef = useRef(0);
  const edgeAnchorYRef = useRef<number | null>(null);
  const onPullRefreshRef = useRef(onPullRefresh);
  const isRefreshingRef = useRef(isRefreshing);

  useEffect(() => {
    onPullRefreshRef.current = onPullRefresh;
  }, [onPullRefresh]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    const isAtTop = () => window.scrollY <= 2;

    const resetPull = () => {
      edgeAnchorYRef.current = null;
      if (pullDistanceRef.current !== 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (document.body.style.overflow === 'hidden') return;
      if (e.touches.length === 1 && isAtTop()) {
        edgeAnchorYRef.current = e.touches[0].clientY;
      } else {
        edgeAnchorYRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (document.body.style.overflow === 'hidden') return;
      if (e.touches.length !== 1 || edgeAnchorYRef.current === null) return;

      if (!isAtTop()) {
        resetPull();
        return;
      }

      const deltaY = e.touches[0].clientY - edgeAnchorYRef.current;
      if (deltaY > 8) {
        const pull = Math.min(120, (deltaY - 8) * 0.6);
        pullDistanceRef.current = pull;
        setPullDistance(pull);
      } else if (pullDistanceRef.current > 0) {
        resetPull();
      }
    };

    const onTouchEnd = () => {
      if (
        pullDistanceRef.current >= PULL_REFRESH_THRESHOLD &&
        !isRefreshingRef.current &&
        onPullRefreshRef.current
      ) {
        onPullRefreshRef.current();
      }
      resetPull();
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const showIndicator = pullDistance > 8 || isRefreshing;
  const pullProgress = Math.min(1, pullDistance / PULL_REFRESH_THRESHOLD);
  const indicatorY = isRefreshing ? 56 : Math.min(72, pullDistance * 0.85);

  return (
    <>
      {/* Google-Style Mobile Pull-to-Refresh Circular Loading Indicator */}
      <div
        aria-hidden={!isRefreshing}
        style={{
          transform: `translate(-50%, ${showIndicator ? indicatorY : -48}px) scale(${
            showIndicator ? Math.max(0.65, pullProgress || 1) : 0.5
          })`,
          opacity: showIndicator ? Math.min(1, pullProgress * 1.25 || 1) : 0,
        }}
        className="pointer-events-none fixed top-3 left-1/2 z-[75] flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.16] bg-[#121620] shadow-xl transition-all duration-150 ease-out md:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${Math.round(pullProgress * 300)}deg)`,
          }}
          className={`h-5 w-5 text-[#3ddc97] ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="42 18"
          />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col flex-1">{children}</div>
    </>
  );
}
