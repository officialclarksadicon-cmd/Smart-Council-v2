import { ReactNode } from 'react';
import { getCurrentAcademicYearLabel } from '../siteConfig';

export interface ClaudeWindowTab {
  label: string;
  tone?: 'neutral' | 'amber' | 'green' | 'yellow' | 'red';
  active?: boolean;
  onClick?: () => void;
}

interface ClaudeWindowBarProps {
  tabs: ClaudeWindowTab[];
  versionLabel?: string;
  rightSlot?: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<NonNullable<ClaudeWindowTab['tone']>, string> = {
  neutral: 'claude-tag',
  amber: 'claude-tag claude-tag-amber',
  green: 'claude-tag claude-tag-green',
  yellow: 'claude-tag claude-tag-yellow',
  red: 'claude-tag claude-tag-red',
};

/**
 * ARCHITECTURAL WINDOW BAR
 * Renders the 3 tactile traffic-light dots (Terracotta Red, Ochre Yellow, Botanical Green),
 * crisp 1px dark-outlined monospace status/tab boxes, and a dynamic academic year badge.
 */
export function ClaudeWindowBar({
  tabs,
  versionLabel = getCurrentAcademicYearLabel(),
  rightSlot,
  className = '',
}: ClaudeWindowBarProps) {
  return (
    <div
      className={`w-full border-b border-white/[0.14] bg-[#0b0e15] px-4 sm:px-8 lg:px-10 py-3 flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      {/* Left: 3 Traffic-Light Dots + Boxy Outlined Monospace Tags */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
        <div
          aria-hidden="true"
          className="inline-flex items-center gap-1.5 pr-1.5 shrink-0"
        >
          <span className="h-3 w-3 rounded-full bg-[#e05a47] border border-black/20 inline-block" />
          <span className="h-3 w-3 rounded-full bg-[#e8aa42] border border-black/20 inline-block" />
          <span className="h-3 w-3 rounded-full bg-[#4ba368] border border-black/20 inline-block" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {tabs.map((tab, idx) => {
            const resolvedTone =
              tab.tone ?? (tab.active ? 'amber' : 'neutral');
            const tagClasses = TONE_CLASS[resolvedTone];

            if (tab.onClick) {
              return (
                <button
                  key={`${tab.label}-${idx}`}
                  type="button"
                  onClick={tab.onClick}
                  className={`${tagClasses} cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all`}
                >
                  {tab.label}
                </button>
              );
            }

            return (
              <span key={`${tab.label}-${idx}`} className={tagClasses}>
                {tab.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Right: Version / Status Pill & Custom Slot */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {rightSlot}
        {versionLabel && (
          <span className="claude-pill-version">{versionLabel}</span>
        )}
      </div>
    </div>
  );
}
