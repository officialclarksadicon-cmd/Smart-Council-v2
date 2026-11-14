import {
  ChangeEvent,
  PointerEvent,
  WheelEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Crop,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Move,
  RotateCcw,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CardFramePreset,
  DEFAULT_IMAGEKIT_ASSETS,
  ImageFraming,
  ImageKitCloudFile,
  ImageKitFolder,
  buildFramedImageUrl,
  getDefaultImageFraming,
  getImageFramingStyle,
  listImageKitFiles,
  parseImageFraming,
  resolveImageUrl,
  stripImageFramingHash,
  uploadToImageKit,
} from '../utils/imagekit';

export type { CardFramePreset };

interface ImageKitUploaderProps {
  value: string;
  onChange: (nextUrl: string) => void;
  folder: ImageKitFolder;
  label?: string;
  aspect?: 'landscape' | 'portrait' | 'square';
  cardType?: CardFramePreset;
}

const CARD_PRESETS: Array<{
  id: CardFramePreset;
  label: string;
  ratio: string;
  aspectClass: string;
  stageWidthClass: string;
  baseAspect: 'portrait' | 'landscape' | 'square';
}> = [
  {
    id: 'portrait',
    label: 'Team Portrait',
    ratio: '3:4',
    aspectClass: 'aspect-[3/4]',
    stageWidthClass: 'w-52 sm:w-60',
    baseAspect: 'portrait',
  },
  {
    id: 'announcement',
    label: 'Announcement',
    ratio: '21:9',
    aspectClass: 'aspect-[21/9]',
    stageWidthClass: 'w-full max-w-lg',
    baseAspect: 'landscape',
  },
  {
    id: 'event',
    label: 'Event Card',
    ratio: '4:3',
    aspectClass: 'aspect-[4/3]',
    stageWidthClass: 'w-full max-w-md',
    baseAspect: 'landscape',
  },
  {
    id: 'about',
    label: 'About SLAC',
    ratio: '4:3',
    aspectClass: 'aspect-[4/3]',
    stageWidthClass: 'w-full max-w-md',
    baseAspect: 'landscape',
  },
  {
    id: 'cover',
    label: 'Full Banner',
    ratio: '16:9',
    aspectClass: 'aspect-[16/9]',
    stageWidthClass: 'w-full max-w-lg',
    baseAspect: 'landscape',
  },
  {
    id: 'logo',
    label: 'Logo',
    ratio: '1:1',
    aspectClass: 'aspect-square',
    stageWidthClass: 'w-48 sm:w-56',
    baseAspect: 'square',
  },
];

function inferDefaultCardPreset(
  folder: ImageKitFolder,
  aspect: 'landscape' | 'portrait' | 'square',
  explicitPreset?: CardFramePreset
): CardFramePreset {
  if (explicitPreset) return explicitPreset;
  if (folder === 'logo' || aspect === 'square') return 'logo';
  if (folder === 'officers' || aspect === 'portrait') return 'portrait';
  if (folder === 'announcements') return 'announcement';
  if (folder === 'events') return 'event';
  if (folder === 'council-stock') return 'about';
  return 'cover';
}

/**
 * INTUITIVE, MINIMAL-TEXT IMAGEKIT UPLOADER & POP-UP CARD FRAMING WINDOW
 * - Uploads directly to https://ik.imagekit.io/slacssc via ImageKit API
 * - Dedicated pop-up window to drag & zoom photos across exact card sizes
 * - Built-in Discard / Keep Editing outside-tap protection
 */
export function ImageKitUploader({
  value,
  onChange,
  folder,
  label = 'Photo',
  aspect = 'landscape',
  cardType,
}: ImageKitUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [useRawFallback, setUseRawFallback] = useState(false);

  // Cloud Library Picker state
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryFiles, setLibraryFiles] = useState<ImageKitCloudFile[]>(
    DEFAULT_IMAGEKIT_ASSETS
  );
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // Dedicated Pop-Up Adjustment Modal State
  const defaultPreset = inferDefaultCardPreset(folder, aspect, cardType);
  const savedFraming = parseImageFraming(value, aspect);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<CardFramePreset>(
    savedFraming.cardPreset ?? defaultPreset
  );
  const [draftFraming, setDraftFraming] = useState<ImageFraming>(savedFraming);
  const [initialFramingSnapshot, setInitialFramingSnapshot] =
    useState<ImageFraming>(savedFraming);
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const dragSessionRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  // Always reset error state when value changes so newly uploaded photos display immediately
  useEffect(() => {
    setPreviewFailed(false);
    setUseRawFallback(false);
  }, [value]);

  const transformedUrl = resolveImageUrl(
    value,
    aspect === 'portrait'
      ? 'w-700,c-at_max,f-auto,q-85'
      : aspect === 'square'
        ? 'w-600,c-at_max,f-auto,q-90'
        : 'w-900,c-at_max,f-auto,q-85'
  );
  const rawCleanUrl = stripImageFramingHash(value);
  const previewUrl = useRawFallback ? rawCleanUrl : transformedUrl;

  const activePresetMeta =
    CARD_PRESETS.find((p) => p.id === activePreset) ?? CARD_PRESETS[0];

  const isDraftDirty =
    draftFraming.fit !== initialFramingSnapshot.fit ||
    Math.round(draftFraming.x) !== Math.round(initialFramingSnapshot.x) ||
    Math.round(draftFraming.y) !== Math.round(initialFramingSnapshot.y) ||
    Math.abs(draftFraming.zoom - initialFramingSnapshot.zoom) >= 0.02 ||
    draftFraming.cardPreset !== initialFramingSnapshot.cardPreset;

  const openAdjustmentModal = (targetUrl = value) => {
    if (!targetUrl.trim()) return;
    const parsed = parseImageFraming(targetUrl, aspect);
    const resolvedPreset = parsed.cardPreset ?? defaultPreset;
    const snapshot: ImageFraming = {
      ...parsed,
      cardPreset: resolvedPreset,
    };
    setActivePreset(resolvedPreset);
    setDraftFraming(snapshot);
    setInitialFramingSnapshot(snapshot);
    setShowExitConfirm(false);
    setAdjustModalOpen(true);
  };

  const requestCloseAdjustmentModal = () => {
    if (isDraftDirty) {
      setShowExitConfirm(true);
      return;
    }
    setShowExitConfirm(false);
    setAdjustModalOpen(false);
  };

  const handleDiscardAdjustment = () => {
    setDraftFraming(initialFramingSnapshot);
    setShowExitConfirm(false);
    setAdjustModalOpen(false);
  };

  const handleApplyAdjustment = () => {
    if (!value.trim()) {
      setAdjustModalOpen(false);
      return;
    }
    const nextUrl = buildFramedImageUrl(
      value,
      {
        ...draftFraming,
        cardPreset: activePreset,
      },
      aspect
    );
    onChange(nextUrl);
    setShowExitConfirm(false);
    setAdjustModalOpen(false);
  };

  const resetDraftFraming = () => {
    const defaults = getDefaultImageFraming(activePresetMeta.baseAspect);
    setDraftFraming({
      ...defaults,
      cardPreset: activePreset,
    });
  };

  const handleOpenLibrary = async () => {
    setLibraryOpen((prev) => !prev);
    setLoadingLibrary(true);
    try {
      const res = await listImageKitFiles(folder);
      if (res.files.length > 0) {
        setLibraryFiles(res.files);
      }
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    if (!adjustModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showExitConfirm) {
          setShowExitConfirm(false);
        } else if (isDraftDirty) {
          setShowExitConfirm(true);
        } else {
          setAdjustModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [adjustModalOpen, showExitConfirm, isDraftDirty]);

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg('');
    setUploading(true);
    try {
      const uploaded = await uploadToImageKit(file, folder);
      setPreviewFailed(false);
      setUseRawFallback(false);
      const initialFraming: ImageFraming = {
        ...getDefaultImageFraming(aspect),
        cardPreset: defaultPreset,
      };
      const nextUrl = buildFramedImageUrl(
        uploaded.url,
        initialFraming,
        aspect
      );
      onChange(nextUrl);
      setActivePreset(defaultPreset);
      setDraftFraming(initialFraming);
      setInitialFramingSnapshot(initialFraming);
      setShowExitConfirm(false);
      setAdjustModalOpen(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to upload photo.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleStagePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!value.trim() || previewFailed) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingStage(true);
    dragSessionRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: draftFraming.x,
      startY: draftFraming.y,
    };
  };

  const handleStagePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const dx = e.clientX - session.startClientX;
    const dy = e.clientY - session.startClientY;

    const sensitivity = Math.max(0.22, 0.38 / Math.max(0.8, draftFraming.zoom));
    const nextX = Math.max(
      0,
      Math.min(100, Math.round(session.startX - dx * sensitivity))
    );
    const nextY = Math.max(
      0,
      Math.min(100, Math.round(session.startY - dy * sensitivity))
    );

    setDraftFraming((prev) => ({
      ...prev,
      x: nextX,
      y: nextY,
    }));
  };

  const handleStagePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (dragSessionRef.current?.pointerId === e.pointerId) {
      dragSessionRef.current = null;
      setIsDraggingStage(false);
    }
  };

  const handleStageWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.06 : -0.06;
    setDraftFraming((prev) => ({
      ...prev,
      zoom: Math.max(
        0.6,
        Math.min(2.4, Math.round((prev.zoom + delta) * 100) / 100)
      ),
    }));
  };

  const draftPreviewUrl = buildFramedImageUrl(
    value,
    { ...draftFraming, cardPreset: activePreset },
    activePresetMeta.baseAspect
  );

  return (
    <div className="space-y-2">
      {label && (
        <span className="block text-xs font-semibold text-[#b4bac6]">
          {label}
        </span>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => void handleFileSelected(e)}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      <div className="rounded-xl border border-white/[0.12] bg-[#0b0e15] p-3 space-y-2.5">
        <div className="flex items-center gap-3">
          {/* Card-Proportional Thumbnail */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              if (value.trim() && !previewFailed) {
                openAdjustmentModal();
              } else {
                fileInputRef.current?.click();
              }
            }}
            aria-label={value.trim() ? 'Adjust picture' : 'Upload picture'}
            className={`group relative shrink-0 rounded-lg border border-white/[0.12] bg-[#121620] overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#3ddc97]/50 transition-all disabled:opacity-60 ${
              defaultPreset === 'portrait'
                ? 'w-14 aspect-[3/4]'
                : defaultPreset === 'logo'
                  ? 'w-14 aspect-square p-1.5'
                  : defaultPreset === 'announcement'
                    ? 'w-24 aspect-[21/9]'
                    : 'w-20 aspect-[4/3]'
            }`}
          >
            {previewUrl && !previewFailed ? (
              <>
                <img
                  src={previewUrl}
                  alt="Preview"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (!useRawFallback && rawCleanUrl !== previewUrl) {
                      setUseRawFallback(true);
                    } else {
                      setPreviewFailed(true);
                    }
                  }}
                  style={getImageFramingStyle(value, aspect)}
                  className="h-full w-full pointer-events-none"
                />
                <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[#3ddc97]">
                  <Crop className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </>
            ) : (
              <ImageIcon
                className="h-5 w-5 text-[#949ba8]"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Minimal Action Bar */}
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg bg-[#3ddc97] px-3 py-1.5 text-xs font-semibold text-[#042412] hover:bg-[#34c786] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {uploading ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {uploading ? 'Uploading...' : value.trim() ? 'Change' : 'Upload'}
              </span>
            </button>

            {value.trim() && previewUrl && !previewFailed && (
              <button
                type="button"
                onClick={() => openAdjustmentModal()}
                className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-[#3ddc97]/40 bg-[#3ddc97]/12 px-3 py-1.5 text-xs font-semibold text-[#3ddc97] hover:bg-[#3ddc97]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Crop className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Adjust</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleOpenLibrary()}
              className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-white/[0.12] bg-[#121620] px-2.5 py-1.5 text-xs font-medium text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.24] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5 text-[#38bdf8]" aria-hidden="true" />
              <span>ImageKit</span>
            </button>

            {value.trim() && (
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => {
                  setPreviewFailed(false);
                  onChange('');
                }}
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-white/[0.1] bg-[#181d29] text-[#b4bac6] hover:text-[#f87171] hover:border-[#ef4444]/35 transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* ImageKit Cloud Asset Quick Picker */}
        <AnimatePresence>
          {libraryOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden pt-2 border-t border-white/[0.08]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-[#b4bac6]">
                  ImageKit Cloud Assets (ik.imagekit.io/slacssc)
                </span>
                {loadingLibrary && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3ddc97]" />
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto no-scrollbar">
                {libraryFiles.map((item) => (
                  <button
                    key={item.fileId || item.url}
                    type="button"
                    onClick={() => {
                      const next = buildFramedImageUrl(
                        item.url,
                        {
                          ...getDefaultImageFraming(aspect),
                          cardPreset: defaultPreset,
                        },
                        aspect
                      );
                      onChange(next);
                      setLibraryOpen(false);
                      openAdjustmentModal(next);
                    }}
                    className="group relative aspect-[4/3] rounded-lg border border-white/[0.1] bg-[#121620] overflow-hidden hover:border-[#3ddc97] cursor-pointer"
                    title={item.name}
                  >
                    <img
                      src={item.thumbnail || item.url}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {errorMsg && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-[#fca5a5]"
        >
          {errorMsg}
        </p>
      )}

      {/* DEDICATED POP-UP PICTURE ADJUSTMENT WINDOW (INTUITIVE & MINIMAL TEXT) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {adjustModalOpen && value.trim() && previewUrl && !previewFailed && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="pic-adjust-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={(e) => {
                  e.stopPropagation();
                  requestCloseAdjustmentModal();
                }}
                className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-xl rounded-2xl border border-white/[0.14] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#0d1017]">
                    <div className="flex items-center gap-2">
                      <Crop
                        className="h-4 w-4 text-[#3ddc97]"
                        aria-hidden="true"
                      />
                      <h3
                        id="pic-adjust-modal-title"
                        className="text-sm sm:text-base font-bold text-[#f5f4f0]"
                      >
                        Adjust Picture
                      </h3>
                    </div>

                    <button
                      type="button"
                      aria-label="Close picture adjustment"
                      onClick={requestCloseAdjustmentModal}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Outside-Tap Discard / Keep Editing Guard */}
                  <AnimatePresence>
                    {showExitConfirm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-b border-[#facc15]/35 bg-[#facc15]/10 px-5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <span className="text-xs font-semibold text-[#f5f4f0]">
                          Unsaved changes
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowExitConfirm(false)}
                            className="min-h-[32px] px-3 py-1 rounded-lg bg-[#3ddc97] text-xs font-semibold text-[#042412] cursor-pointer"
                          >
                            Keep Editing
                          </button>
                          <button
                            type="button"
                            onClick={handleDiscardAdjustment}
                            className="min-h-[32px] px-3 py-1 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 text-xs font-semibold text-[#fca5a5] cursor-pointer"
                          >
                            Discard
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Card Size Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {CARD_PRESETS.map((preset) => {
                        const isSelected = preset.id === activePreset;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setActivePreset(preset.id);
                              setDraftFraming((prev) => ({
                                ...prev,
                                cardPreset: preset.id,
                              }));
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#3ddc97] bg-[#3ddc97]/15 text-[#3ddc97]'
                                : 'border-white/[0.1] bg-[#0b0e15] text-[#b4bac6] hover:text-[#f5f4f0]'
                            }`}
                          >
                            <span>{preset.label}</span>
                            <span className="text-[10px] opacity-75">
                              {preset.ratio}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Interactive Drag Stage */}
                    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#080b12] p-4 min-h-[250px]">
                      <div
                        onPointerDown={handleStagePointerDown}
                        onPointerMove={handleStagePointerMove}
                        onPointerUp={handleStagePointerUp}
                        onPointerCancel={handleStagePointerUp}
                        onWheel={handleStageWheel}
                        className={`relative overflow-hidden rounded-xl border-2 border-[#3ddc97]/60 bg-[#0d1017] shadow-2xl select-none touch-none cursor-grab active:cursor-grabbing transition-all ${activePresetMeta.aspectClass} ${activePresetMeta.stageWidthClass}`}
                      >
                        <img
                          src={previewUrl}
                          alt="Drag to frame"
                          draggable={false}
                          referrerPolicy="no-referrer"
                          style={getImageFramingStyle(
                            draftPreviewUrl,
                            activePresetMeta.baseAspect
                          )}
                          className="h-full w-full pointer-events-none"
                        />

                        {/* Subtle 3x3 Grid When Dragging */}
                        <div
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 transition-opacity duration-150 ${
                            isDraggingStage ? 'opacity-85' : 'opacity-20'
                          }`}
                        >
                          <div className="border-r border-b border-white/30" />
                          <div className="border-r border-b border-white/30" />
                          <div className="border-b border-white/30" />
                          <div className="border-r border-b border-white/30" />
                          <div className="border-r border-b border-white/30" />
                          <div className="border-b border-white/30" />
                          <div className="border-r border-white/30" />
                          <div className="border-r border-white/30" />
                          <div />
                        </div>

                        <div className="pointer-events-none absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-semibold text-[#f5f4f0]">
                          <span className="inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-0.5 text-[#3ddc97]">
                            <Move className="h-3 w-3" aria-hidden="true" />
                            Drag
                          </span>
                          <span className="rounded-md bg-black/65 px-2 py-0.5 text-[#b4bac6] tabular-nums">
                            {activePresetMeta.ratio}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Simple Zoom Bar + Quick Toggle Pills */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0b0e15] px-3.5 py-2.5">
                        <ZoomOut
                          className="h-4 w-4 text-[#949ba8] shrink-0"
                          aria-hidden="true"
                        />
                        <input
                          type="range"
                          min={0.6}
                          max={2.4}
                          step={0.05}
                          value={draftFraming.zoom}
                          onChange={(e) =>
                            setDraftFraming((prev) => ({
                              ...prev,
                              zoom: parseFloat(e.target.value),
                            }))
                          }
                          aria-label="Zoom"
                          className="flex-1 accent-[#3ddc97] cursor-pointer"
                        />
                        <ZoomIn
                          className="h-4 w-4 text-[#3ddc97] shrink-0"
                          aria-hidden="true"
                        />
                        <span className="w-11 text-right text-xs font-semibold text-[#f5f4f0] tabular-nums">
                          {Math.round(draftFraming.zoom * 100)}%
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setDraftFraming((prev) => ({
                                ...prev,
                                fit: prev.fit === 'cover' ? 'contain' : 'cover',
                              }))
                            }
                            className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                              draftFraming.fit === 'contain'
                                ? 'bg-[#facc15]/15 border-[#facc15]/40 text-[#facc15]'
                                : 'bg-[#121620] border-white/[0.12] text-[#f5f4f0]'
                            }`}
                          >
                            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {draftFraming.fit === 'contain' ? 'Fit' : 'Fill'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDraftFraming((prev) => ({
                                ...prev,
                                x: 50,
                                y: 50,
                              }))
                            }
                            className="inline-flex items-center min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border border-white/[0.12] bg-[#121620] text-[#b4bac6] hover:text-[#f5f4f0] cursor-pointer"
                          >
                            Center
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={resetDraftFraming}
                          className="inline-flex items-center gap-1 min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border border-white/[0.12] bg-[#121620] text-[#b4bac6] hover:text-[#f5f4f0] cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Reset</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-white/[0.08] bg-[#0d1017]">
                    <button
                      type="button"
                      onClick={requestCloseAdjustmentModal}
                      className="min-h-[38px] px-4 py-1.5 rounded-lg border border-white/[0.12] bg-[#181d29] text-xs font-medium text-[#b4bac6] hover:text-[#f5f4f0] cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleApplyAdjustment}
                      className="gemini-cta inline-flex items-center gap-1.5 min-h-[38px] px-5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>Done</span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
