import { PageRoute, siteConfig } from '../siteConfig';
import { SiteLogo } from './SiteLogo';

interface FooterProps {
  currentPage?: PageRoute;
  customLogoUrl?: string;
  onNavigate: (page: PageRoute) => void;
  onOpenContact: () => void;
  onOpenOfficialAuth: () => void;
}

/**
 * FOOTER SECTION
 * - On the Home page (currentPage === 'home'): Displays the full multi-column
 *   portal directory + the very bottom copyright footer bar.
 * - On all other pages (currentPage !== 'home'): Displays ONLY the very bottom
 *   compact copyright footer bar.
 */
export function Footer({
  currentPage = 'home',
  customLogoUrl,
  onNavigate,
  onOpenContact,
  onOpenOfficialAuth,
}: FooterProps) {
  const { brand, councilInfo, footer } = siteConfig;
  const isHomePage = currentPage === 'home';

  if (!isHomePage) {
    return (
      <footer className="w-full mt-auto bg-[#07090e] border-t border-white/[0.14] text-[#949ba8]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <p>{footer.copyright}</p>
          <p>{footer.bottomNote}</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full mt-auto bg-[#07090e] border-t border-white/[0.14] text-[#b4bac6]">
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] px-6 sm:px-10 lg:px-12 py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-white/[0.14]">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-2.5">
            <SiteLogo onNavigate={onNavigate} customLogoUrl={customLogoUrl} />
            <p className="text-sm text-[#b4bac6] leading-relaxed max-w-sm">
              {footer.description}
            </p>
            <div className="pt-1 space-y-1 text-xs text-[#949ba8]">
              <p>{brand.institution}</p>
              <p>{councilInfo.officeLocation}</p>
            </div>
          </div>

          {/* Dedicated Page Links & Student Support */}
          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-[#f5f4f0]">
                Portal Pages
              </h3>
              <ul className="mt-3 space-y-1.5">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('home')}
                    className="inline-flex min-h-[36px] items-center text-sm text-[#b4bac6] hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('announcements')}
                    className="inline-flex min-h-[36px] items-center text-sm text-[#b4bac6] hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    Announcements
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('events')}
                    className="inline-flex min-h-[36px] items-center text-sm text-[#b4bac6] hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    Events Gallery
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('officers')}
                    className="inline-flex min-h-[36px] items-center text-sm text-[#b4bac6] hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    Council Archive
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f5f4f0]">
                Student Help
              </h3>
              <ul className="mt-3 space-y-1.5">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('faq')}
                    className="inline-flex min-h-[36px] items-center text-sm text-[#b4bac6] hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    FAQ
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('forum')}
                    className="inline-flex min-h-[36px] items-center text-sm text-[#b4bac6] hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    Student Forum
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenContact}
                    className="inline-flex min-h-[36px] items-center text-sm text-[#b4bac6] hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    Contact SSC
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onOpenOfficialAuth}
                    className="inline-flex min-h-[36px] items-center text-sm text-[#b4bac6] hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    Official Login
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#f5f4f0]">
                Connect &amp; Support
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-[#b4bac6]">
                <li>
                  <a
                    href={`mailto:${councilInfo.supportEmail}`}
                    className="inline-flex min-h-[36px] items-center hover:text-[#3ddc97] transition-colors break-words max-w-full"
                  >
                    {councilInfo.supportEmail}
                  </a>
                </li>
                <li>
                  <a
                    href={councilInfo.facebookPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center hover:text-[#3ddc97] transition-colors"
                  >
                    SLAC SSC on Facebook
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                    className="inline-flex min-h-[36px] items-center hover:text-[#3ddc97] transition-colors cursor-pointer"
                  >
                    Back to top
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#949ba8]">
          <p>{footer.copyright}</p>
          <p>{footer.bottomNote}</p>
        </div>
      </div>
    </footer>
  );
}
