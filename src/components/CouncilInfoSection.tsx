import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Camera,
  Check,
  Clock,
  Copy,
  Edit3,
  Mail,
  MapPin,
  MessageSquare,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { OfficialProfile, PortalBranding, siteConfig } from '../siteConfig';
import { ScrollReveal } from './ScrollReveal';
import { WordRevealText } from './WordRevealText';
import { ImageKitUploader } from './ImageKitUploader';
import {
  getImageFramingStyle,
  normalizeImageKitInput,
  resolveImageUrl,
  stripImageFramingHash,
} from '../utils/imagekit';

interface CouncilInfoSectionProps {
  aboutImage?: string;
  customLogoUrl?: string;
  official?: OfficialProfile | null;
  onUpdateBranding?: (patch: Partial<PortalBranding>) => void;
  onOpenContact: () => void;
}

/**
 * BODY SECTION 2: COUNCIL HERITAGE & DIRECT SUPPORT
 * Includes direct photo & logo upload/editing on the About SLAC card with
 * the dedicated Picture Adjustment pop-up and Discard / Keep Editing guard.
 */
export function CouncilInfoSection({
  aboutImage,
  customLogoUrl,
  official,
  onUpdateBranding,
  onOpenContact,
}: CouncilInfoSectionProps) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [useRawFallback, setUseRawFallback] = useState(false);

  // Direct About SLAC Card Photo & Logo Editor Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [draftAboutImg, setDraftAboutImg] = useState('');
  const [draftLogoImg, setDraftLogoImg] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { councilInfo, councilSection } = siteConfig;
  const activeAboutImage = aboutImage || councilSection.image;
  const activeLogoUrl = customLogoUrl || siteConfig.brand.customLogoUrl;

  useEffect(() => {
    setImageError(false);
    setUseRawFallback(false);
  }, [activeAboutImage]);

  const transformedAboutUrl = resolveImageUrl(
    activeAboutImage,
    'w-900,c-at_max,f-auto,q-85'
  );
  const rawAboutUrl = stripImageFramingHash(activeAboutImage);
  const displayAboutUrl = useRawFallback ? rawAboutUrl : transformedAboutUrl;

  const openEditor = () => {
    setDraftAboutImg(activeAboutImage);
    setDraftLogoImg(activeLogoUrl);
    setShowDiscardConfirm(false);
    setEditModalOpen(true);
  };

  const isDirty =
    draftAboutImg !== activeAboutImage || draftLogoImg !== activeLogoUrl;

  const requestCloseEditor = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    setShowDiscardConfirm(false);
    setEditModalOpen(false);
  };

  const handleSaveBranding = (e: FormEvent) => {
    e.preventDefault();
    onUpdateBranding?.({
      aboutSlacImage:
        normalizeImageKitInput(draftAboutImg) || councilSection.image,
      customLogoUrl:
        normalizeImageKitInput(draftLogoImg) || siteConfig.brand.customLogoUrl,
    });
    setShowDiscardConfirm(false);
    setEditModalOpen(false);
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(councilInfo.supportEmail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id="council-info"
      aria-labelledby="council-info-heading"
      className="w-full border-b border-white/[0.14]"
    >
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620]">
        {/* Structured Boxy Outlined About Section Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-white/[0.14] items-stretch">
          <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-white/[0.14] p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
            <div className="pb-5 border-b border-white/[0.12]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#facc15]">
                  {councilSection.eyebrow}
                </p>
                {official && onUpdateBranding && (
                  <button
                    type="button"
                    onClick={openEditor}
                    className="inline-flex items-center gap-1.5 rounded-none border border-[#3ddc97]/35 bg-[#3ddc97]/12 px-3 py-1.5 text-xs font-semibold text-[#3ddc97] hover:bg-[#3ddc97]/20 transition-colors cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Edit About Photo &amp; Logo</span>
                  </button>
                )}
              </div>

              <WordRevealText
                as="h2"
                id="council-info-heading"
                text={councilSection.heading}
                className="mt-2.5 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#f5f4f0]"
                y={24}
                stagger={0.08}
                highlightWords={['SLAC', 'since', '2019.']}
              />

              <p className="mt-3 text-base text-[#b4bac6] leading-relaxed max-w-xl">
                {councilSection.description}
              </p>
            </div>

            <dl className="mt-2 divide-y divide-white/[0.12]">
              {councilSection.pillars.map((pillar, idx) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{
                    once: true,
                    amount: 0.2,
                    margin: '0px 0px -6% 0px',
                  }}
                  transition={{
                    duration: 0.35,
                    delay: idx * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-4 items-baseline will-change-transform"
                >
                  <dt className="sm:col-span-5 flex items-baseline gap-2.5 text-sm font-bold text-[#f5f4f0] tabular-nums">
                    <span className="text-xs font-semibold text-[#3ddc97]">
                      0{idx + 1}
                    </span>
                    <span>{pillar.title}</span>
                  </dt>
                  <dd className="sm:col-span-7 text-xs sm:text-sm text-[#b4bac6] leading-relaxed">
                    {pillar.detail}
                  </dd>
                </motion.div>
              ))}
            </dl>
          </div>

          {/* Right: Editable About SLAC Campus Council Boxy Photo Cell */}
          <ScrollReveal className="lg:col-span-5 flex" delay={0.06}>
            <div className="group relative w-full min-h-[280px] rounded-none overflow-hidden flex flex-col bg-[#0b0e15]">
              <div className="relative flex-1 min-h-[240px] bg-[#181d29] overflow-hidden">
                {displayAboutUrl && !imageError ? (
                  <img
                    src={displayAboutUrl}
                    alt={councilSection.imageAlt}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      if (!useRawFallback && rawAboutUrl !== displayAboutUrl) {
                        setUseRawFallback(true);
                      } else {
                        setImageError(true);
                      }
                    }}
                    style={getImageFramingStyle(activeAboutImage, 'landscape')}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
                    <span className="text-3xl font-bold text-[#3ddc97] tabular-nums">
                      Est. {councilInfo.establishedYear}
                    </span>
                    <span className="mt-1 text-sm font-medium text-[#b4bac6]">
                      {siteConfig.brand.fullName}
                    </span>
                  </div>
                )}

                {official && onUpdateBranding && (
                  <button
                    type="button"
                    onClick={openEditor}
                    className="photo-overlay absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-none bg-[#0b0e15]/90 border border-white/[0.2] px-3 py-1.5 text-xs font-semibold text-[#f5f4f0] hover:border-[#3ddc97] hover:text-[#3ddc97] shadow-lg transition-colors cursor-pointer"
                  >
                    <Camera
                      className="h-3.5 w-3.5 text-[#3ddc97]"
                      aria-hidden="true"
                    />
                    <span>Change Photo</span>
                  </button>
                )}
              </div>
              <div className="px-6 py-4 border-t border-white/[0.14] flex items-center justify-between text-xs text-[#b4bac6] bg-[#121620]">
                <span className="font-semibold text-[#f5f4f0]">
                  {siteConfig.brand.institution}
                </span>
                <span className="tabular-nums font-semibold text-[#facc15]">
                  Est. {councilInfo.establishedYear}
                </span>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Unified Student Support & Office Desk (Boxy Outlined Karst Row) */}
        <ScrollReveal>
          <article className="rounded-none overflow-hidden bg-[#121620]">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-white/[0.14] p-6 sm:p-10 lg:p-12 space-y-5">
                <WordRevealText
                  as="h3"
                  text={councilSection.supportCard.title}
                  className="text-xl sm:text-2xl font-bold text-[#f5f4f0]"
                  y={28}
                  stagger={0.1}
                  highlightWords={['Support', 'Desk']}
                />

                <p className="text-sm sm:text-[15px] text-[#b4bac6] leading-relaxed max-w-xl">
                  {councilSection.supportCard.description}
                </p>

                <div className="flex flex-col gap-3">
                  {/* Office Room Notice */}
                  <div className="rounded-none border border-white/[0.14] bg-[#0b0e15] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 text-xs sm:text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#f5f4f0]">
                      <MapPin
                        className="h-4 w-4 text-[#3ddc97] shrink-0"
                        aria-hidden="true"
                      />
                      {councilInfo.officeLocation}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[#facc15] font-medium">
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {councilInfo.availabilityTitle}
                    </span>
                  </div>

                  {/* Facebook Page Action Card */}
                  <a
                    href={councilInfo.facebookPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center justify-between gap-3 rounded-none border border-white/[0.14] bg-[#0b0e15] hover:border-white/[0.28] hover:bg-[#181d29] px-4 py-3.5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-none bg-[#1877F2] text-white shrink-0"
                        aria-hidden="true"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H8v3h2.7V21h2.8z" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#f5f4f0] group-hover:text-[#3ddc97] truncate transition-colors">
                          Follow {councilInfo.facebookPageName} on Facebook
                        </p>
                        <p className="text-xs text-[#949ba8] truncate">
                          {councilInfo.facebookPathLabel}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight
                      className="h-4 w-4 text-[#949ba8] group-hover:text-[#3ddc97] shrink-0 transition-colors"
                      aria-hidden="true"
                    />
                  </a>
                </div>
              </div>

              <div className="lg:col-span-5 p-6 sm:p-10 lg:p-12 flex flex-col justify-center gap-4 bg-[#0b0e15]">
                <div className="flex items-center justify-between gap-3 rounded-none border border-white/[0.14] bg-[#121620] px-4 py-3.5">
                  <span className="text-sm font-medium text-[#f5f4f0] truncate">
                    {councilInfo.supportEmail}
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-none border border-white/[0.14] bg-[#181d29] text-[#f5f4f0] hover:border-white/[0.28] active:scale-95 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check
                          className="h-3.5 w-3.5 text-[#3ddc97]"
                          aria-hidden="true"
                        />
                        <span className="text-[#3ddc97]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{councilSection.supportCard.copyButtonLabel}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={`mailto:${councilInfo.supportEmail}`}
                    className="gemini-cta flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] text-xs sm:text-sm font-bold uppercase tracking-[0.06em] rounded-full active:scale-[0.98] transition-transform whitespace-nowrap shrink-0"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <span>{councilSection.supportCard.emailButtonLabel}</span>
                  </a>

                  <button
                    type="button"
                    onClick={onOpenContact}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] text-xs sm:text-sm font-bold uppercase tracking-[0.06em] rounded-full border border-white/[0.18] text-[#f5f4f0] bg-[#121620] hover:border-white/[0.32] active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    <span>{councilSection.supportCard.onlineFormLabel}</span>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </ScrollReveal>
      </div>

      {/* Direct About SLAC Card Photo & Logo Editor Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {editModalOpen && official && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-slac-editor-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={requestCloseEditor}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleSaveBranding}
                  className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <h3
                      id="about-slac-editor-title"
                      className="text-lg font-bold text-[#f5f4f0]"
                    >
                      Edit About SLAC Photo &amp; Website Logo
                    </h3>
                    <button
                      type="button"
                      aria-label="Close editor"
                      onClick={requestCloseEditor}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Discard / Keep Editing Guard */}
                  <AnimatePresence>
                    {showDiscardConfirm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-b border-[#facc15]/35 bg-[#facc15]/10 px-6 py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle
                            className="h-4 w-4 text-[#facc15] shrink-0"
                            aria-hidden="true"
                          />
                          <span className="text-xs font-bold text-[#f5f4f0]">
                            Discard unsaved photo/logo changes?
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDiscardConfirm(false)}
                            className="min-h-[34px] px-3 py-1 rounded-lg bg-[#3ddc97] text-xs font-semibold text-[#042412] cursor-pointer"
                          >
                            Keep Editing
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowDiscardConfirm(false);
                              setEditModalOpen(false);
                            }}
                            className="min-h-[34px] px-3 py-1 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 text-xs font-semibold text-[#fca5a5] cursor-pointer"
                          >
                            Discard Changes
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="p-6 space-y-5">
                    <ImageKitUploader
                      value={draftAboutImg}
                      onChange={setDraftAboutImg}
                      folder="council-stock"
                      label="About SLAC Card Photo"
                      aspect="landscape"
                      cardType="about"
                    />

                    <ImageKitUploader
                      value={draftLogoImg}
                      onChange={setDraftLogoImg}
                      folder="logo"
                      label="Website Logo"
                      aspect="square"
                      cardType="logo"
                    />

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={requestCloseEditor}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#181d29] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
