import { useEffect, useState } from 'react';
import { Check, Download, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface LogoVariant {
  id: string;
  label: string;
  dimensions: string;
  src: string;
  filename: string;
  previewBgClass: string;
}

const LOGO_VARIANTS: LogoVariant[] = [
  {
    id: 'website',
    label: 'Website Header PNG',
    dimensions: '512 × 512',
    src: 'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo_yvq35sFUH.png',
    filename: 'SLAC-SSC-Logo.png',
    previewBgClass: 'bg-[#0b0d12]',
  },
  {
    id: 'white-1024',
    label: 'High-Res White PNG',
    dimensions: '1024 × 1024',
    src: 'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo-1024-white_nzLKj_s2x.png',
    filename: 'SLAC-SSC-Logo-1024-White.png',
    previewBgClass: 'bg-[#0b0d12]',
  },
  {
    id: 'dark-1024',
    label: 'High-Res Dark PNG',
    dimensions: '1024 × 1024',
    src: 'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo-1024-dark_L-WgIDIvf.png',
    filename: 'SLAC-SSC-Logo-1024-Dark.png',
    previewBgClass: 'bg-[#f4f6fa]',
  },
];

export async function downloadAssetAsBlob(src: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(src);
    if (!response.ok) return false;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    return true;
  } catch {
    return false;
  }
}

interface LogoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogoExportModal({ isOpen, onClose }: LogoExportModalProps) {
  const [downloadedId, setDownloadedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDownload = async (variant: LogoVariant) => {
    setErrorMsg('');
    setDownloadingId(variant.id);
    const ok = await downloadAssetAsBlob(variant.src, variant.filename);
    setDownloadingId(null);
    if (ok) {
      setDownloadedId(variant.id);
      window.setTimeout(() => {
        setDownloadedId((prev) => (prev === variant.id ? null : prev));
      }, 2400);
    } else {
      setErrorMsg('Automatic download was blocked by the browser. Right-click any logo preview above and choose "Save image as...".');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logo-export-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#131519] border border-white/[0.12] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
              <div>
                <h2
                  id="logo-export-title"
                  className="text-lg font-bold text-[#f5f4f0]"
                >
                  SLAC SSC Transparent PNG Logos
                </h2>
                <p className="text-xs text-[#949ba8] mt-0.5">
                  Click Download PNG or right-click any seal preview and choose Save image as.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close logo export dialog"
                onClick={onClose}
                className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar space-y-4">
              {errorMsg && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                  {errorMsg}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {LOGO_VARIANTS.map((variant) => {
                  const isDownloading = downloadingId === variant.id;
                  const isDownloaded = downloadedId === variant.id;

                  return (
                    <div
                      key={variant.id}
                      className="flex flex-col rounded-xl border border-white/[0.08] bg-[#1a1d22] overflow-hidden"
                    >
                      <div
                        className={`flex items-center justify-center p-6 aspect-square border-b border-white/[0.08] ${variant.previewBgClass}`}
                      >
                        <img
                          src={variant.src}
                          alt={`SLAC Supreme Student Council ${variant.label}`}
                          className="h-32 w-32 object-contain select-none"
                        />
                      </div>

                      <div className="p-3.5 flex flex-col flex-1 justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#f5f4f0]">
                            {variant.label}
                          </p>
                          <p className="text-xs text-[#949ba8] tabular-nums mt-0.5">
                            {variant.dimensions} Transparent PNG
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownload(variant)}
                          disabled={isDownloading}
                          className="inline-flex w-full min-h-[38px] items-center justify-center gap-2 rounded-lg bg-[#3ddc97] px-3 py-2 text-xs font-semibold text-[#0b0d12] hover:bg-[#34c786] transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {isDownloaded ? (
                            <>
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Saved PNG
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                              {isDownloading ? 'Preparing...' : 'Download PNG'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
