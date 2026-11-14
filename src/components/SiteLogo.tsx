import { useEffect, useState } from 'react';
import { PageRoute, siteConfig } from '../siteConfig';
import {
  getImageFramingStyle,
  resolveImageUrl,
  stripImageFramingHash,
} from '../utils/imagekit';

interface SiteLogoProps {
  onNavigate?: (page: PageRoute) => void;
  customLogoUrl?: string;
}

/**
 * SMART COUNCIL LOGO COMPONENT
 * Pulls logo from ImageKit API (or custom admin-uploaded logo) with framing support.
 */
export function SiteLogo({ onNavigate, customLogoUrl }: SiteLogoProps) {
  const { name } = siteConfig.brand;
  const activeLogoInput = customLogoUrl || siteConfig.brand.customLogoUrl;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [activeLogoInput]);

  const resolvedLogoSrc =
    resolveImageUrl(activeLogoInput, 'w-256,c-at_max,f-auto,q-90') ||
    stripImageFramingHash(activeLogoInput);

  return (
    <button
      type="button"
      onClick={() => onNavigate?.('home')}
      className="inline-flex items-center gap-2 sm:gap-2.5 whitespace-nowrap shrink-0 group cursor-pointer focus-visible:rounded-md text-left"
    >
      {resolvedLogoSrc && !logoFailed ? (
        <span className="inline-flex h-9 w-9 sm:h-10 sm:w-10 overflow-hidden rounded-full items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105">
          <img
            src={resolvedLogoSrc}
            alt={`${name} emblem`}
            referrerPolicy="no-referrer"
            onError={() => setLogoFailed(true)}
            style={getImageFramingStyle(activeLogoInput, 'square')}
            className="ssc-logo-mark h-full w-full object-contain"
          />
        </span>
      ) : (
        <span
          className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full shrink-0 transition-transform duration-150 group-hover:scale-105"
          aria-hidden="true"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#f5f4f0] transition-colors duration-200"
          >
            <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
            <path d="M9.5 11.5L11.5 13.5L15 9.5" stroke="#3ddc97" />
          </svg>
        </span>
      )}

      <span
        className="text-[15px] sm:text-[17px] font-bold tracking-tight whitespace-nowrap text-[#f5f4f0]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {name}
      </span>
    </button>
  );
}
