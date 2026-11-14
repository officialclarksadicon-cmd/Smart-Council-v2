import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseInitialDate(raw: string): Date {
  const now = new Date();
  if (!raw || !raw.trim()) return now;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    if (parsed.getFullYear() < 2002) {
      parsed.setFullYear(now.getFullYear());
    }
    return parsed;
  }
  const match = raw
    .trim()
    .match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (match) {
    const mIdx = SHORT_MONTHS.findIndex(
      (m) => m.toLowerCase() === match[1].slice(0, 3).toLowerCase()
    );
    if (mIdx >= 0) {
      const day = Number.parseInt(match[2], 10);
      const year = match[3] ? Number.parseInt(match[3], 10) : now.getFullYear();
      return new Date(year, mIdx, day);
    }
  }
  return now;
}

function formatPortalDate(date: Date): string {
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

interface CalendarDatePickerProps {
  id?: string;
  value: string;
  onChange: (formattedDate: string) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Dedicated Interactive Calendar Pop-Up Picker
 */
export function CalendarDatePicker({
  id,
  value,
  onChange,
  placeholder = 'Select date',
}: CalendarDatePickerProps) {
  const [open, setOpen] = useState(false);
  const initialDate = useMemo(() => parseInitialDate(value), [value]);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  useEffect(() => {
    if (open) {
      const d = parseInitialDate(value);
      setSelectedDate(d);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open, value]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; date: Date | null }> = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ day: null, date: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: new Date(viewYear, viewMonth, d) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (d: Date) => {
    setSelectedDate(d);
    onChange(formatPortalDate(d));
    setOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(formatPortalDate(today));
    setOpen(false);
  };

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-left text-sm flex items-center justify-between gap-2 hover:border-[#3ddc97]/50 transition-colors cursor-pointer"
      >
        <span className={value ? 'text-[#f5f4f0] font-medium' : 'text-[#949ba8]'}>
          {value || placeholder}
        </span>
        <CalendarIcon
          className="h-4 w-4 text-[#3ddc97] shrink-0"
          aria-hidden="true"
        />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Choose date"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-xs rounded-2xl border border-white/[0.14] bg-[#131519] p-4 shadow-2xl space-y-3.5"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon
                        className="h-4 w-4 text-[#3ddc97]"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-bold text-[#f5f4f0]">
                        Select Date
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Close calendar"
                      onClick={() => setOpen(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#949ba8] hover:text-[#f5f4f0] hover:bg-white/[0.06] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Month / Year Switcher */}
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={goPrevMonth}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.1] bg-[#0b0e15] text-[#f5f4f0] hover:border-white/[0.24] cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-bold text-[#f5f4f0]">
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </span>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={goNextMonth}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.1] bg-[#0b0e15] text-[#f5f4f0] hover:border-white/[0.24] cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {DAY_LABELS.map((day) => (
                      <span
                        key={day}
                        className="text-[11px] font-semibold text-[#949ba8] py-1"
                      >
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((cell, idx) => {
                      if (!cell.day || !cell.date) {
                        return <div key={`empty-${idx}`} className="h-9" />;
                      }
                      const isSelected =
                        selectedDate.getFullYear() ===
                          cell.date.getFullYear() &&
                        selectedDate.getMonth() === cell.date.getMonth() &&
                        selectedDate.getDate() === cell.date.getDate();

                      const now = new Date();
                      const isToday =
                        now.getFullYear() === cell.date.getFullYear() &&
                        now.getMonth() === cell.date.getMonth() &&
                        now.getDate() === cell.date.getDate();

                      return (
                        <button
                          key={cell.day}
                          type="button"
                          onClick={() => handleSelectDay(cell.date!)}
                          className={`h-9 w-full rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#3ddc97] text-[#042412] font-bold shadow-xs'
                              : isToday
                                ? 'border border-[#3ddc97]/50 text-[#3ddc97] bg-[#3ddc97]/10'
                                : 'text-[#f5f4f0] hover:bg-white/[0.08]'
                          }`}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleSelectToday}
                      className="px-3 py-1.5 rounded-lg border border-white/[0.12] bg-[#0b0e15] text-xs font-semibold text-[#3ddc97] hover:border-[#3ddc97]/40 cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(formatPortalDate(selectedDate));
                        setOpen(false);
                      }}
                      className="gemini-cta px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Apply Date
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

interface ParsedClockTime {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
}

function parseClockString(raw: string): ParsedClockTime {
  const match = raw
    .trim()
    .match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let h = Number.parseInt(match[1], 10);
    if (h < 1 || h > 12) h = 1;
    const m = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
    const p = match[3].toUpperCase() === 'AM' ? 'AM' : 'PM';
    return { hour: h, minute: m, period: p };
  }
  return { hour: 1, minute: 0, period: 'PM' };
}

function formatClockTime(t: ParsedClockTime): string {
  const mm = String(t.minute).padStart(2, '0');
  return `${t.hour}:${mm} ${t.period}`;
}

interface ClockTimePickerProps {
  id?: string;
  value: string;
  onChange: (formattedTime: string) => void;
  placeholder?: string;
}

const CLOCK_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const CLOCK_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * Dedicated Interactive Clock Pop-Up Picker
 */
export function ClockTimePicker({
  id,
  value,
  onChange,
  placeholder = 'Select time',
}: ClockTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [timeState, setTimeState] = useState<ParsedClockTime>(() =>
    parseClockString(value)
  );

  useEffect(() => {
    if (open) {
      setTimeState(parseClockString(value));
      setMode('hour');
    }
  }, [open, value]);

  const dialItems = mode === 'hour' ? CLOCK_HOURS : CLOCK_MINUTES;
  const activeValue = mode === 'hour' ? timeState.hour : timeState.minute;

  const activeIndex =
    mode === 'hour'
      ? CLOCK_HOURS.indexOf(timeState.hour)
      : Math.round(timeState.minute / 5) % 12;
  const handAngleDeg = activeIndex * 30;

  const handleSelectDialValue = (val: number) => {
    if (mode === 'hour') {
      setTimeState((prev) => ({ ...prev, hour: val }));
      setMode('minute');
    } else {
      setTimeState((prev) => ({ ...prev, minute: val }));
    }
  };

  const handleApply = () => {
    onChange(formatClockTime(timeState));
    setOpen(false);
  };

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-left text-sm flex items-center justify-between gap-2 hover:border-[#3ddc97]/50 transition-colors cursor-pointer"
      >
        <span className={value ? 'text-[#f5f4f0] font-medium' : 'text-[#949ba8]'}>
          {value || placeholder}
        </span>
        <Clock
          className="h-4 w-4 text-[#facc15] shrink-0"
          aria-hidden="true"
        />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Choose time"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-xs rounded-2xl border border-white/[0.14] bg-[#131519] p-4 shadow-2xl space-y-4"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div className="flex items-center gap-2">
                      <Clock
                        className="h-4 w-4 text-[#facc15]"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-bold text-[#f5f4f0]">
                        Select Time
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Close clock"
                      onClick={() => setOpen(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#949ba8] hover:text-[#f5f4f0] hover:bg-white/[0.06] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Digital Readout & AM/PM Switcher */}
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-[#0b0e15] px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setMode('hour')}
                        className={`px-2 py-1 rounded-lg text-2xl font-bold tabular-nums transition-colors cursor-pointer ${
                          mode === 'hour'
                            ? 'bg-[#3ddc97]/20 text-[#3ddc97]'
                            : 'text-[#f5f4f0] hover:bg-white/[0.06]'
                        }`}
                      >
                        {String(timeState.hour).padStart(2, '0')}
                      </button>
                      <span className="text-2xl font-bold text-[#949ba8]">:</span>
                      <button
                        type="button"
                        onClick={() => setMode('minute')}
                        className={`px-2 py-1 rounded-lg text-2xl font-bold tabular-nums transition-colors cursor-pointer ${
                          mode === 'minute'
                            ? 'bg-[#3ddc97]/20 text-[#3ddc97]'
                            : 'text-[#f5f4f0] hover:bg-white/[0.06]'
                        }`}
                      >
                        {String(timeState.minute).padStart(2, '0')}
                      </button>
                    </div>

                    <div className="flex flex-col rounded-xl border border-white/[0.1] bg-[#0b0e15] overflow-hidden">
                      {(['AM', 'PM'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setTimeState((prev) => ({ ...prev, period: p }))
                          }
                          className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                            timeState.period === p
                              ? 'bg-[#3ddc97] text-[#042412]'
                              : 'text-[#949ba8] hover:text-[#f5f4f0]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Radial Clock Dial */}
                  <div className="relative mx-auto h-52 w-52 rounded-full border border-white/[0.1] bg-[#0b0e15] select-none">
                    {/* Center Pivot & Clock Hand */}
                    <div
                      style={{
                        transform: `translate(-50%, -100%) rotate(${handAngleDeg}deg)`,
                      }}
                      className="pointer-events-none absolute left-1/2 top-1/2 h-18 w-0.5 origin-bottom bg-[#3ddc97] transition-transform duration-150"
                    />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3ddc97]" />

                    {dialItems.map((num, idx) => {
                      const angleRad = ((idx * 30 - 90) * Math.PI) / 180;
                      const radius = 78;
                      const x = Math.cos(angleRad) * radius;
                      const y = Math.sin(angleRad) * radius;
                      const isSelected = activeValue === num;

                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleSelectDialValue(num)}
                          style={{
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                          }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-xs font-bold tabular-nums flex items-center justify-center transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#3ddc97] text-[#042412] shadow-md'
                              : 'text-[#f5f4f0] hover:bg-white/[0.1]'
                          }`}
                        >
                          {mode === 'minute'
                            ? String(num).padStart(2, '0')
                            : num}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#949ba8]">
                      {formatClockTime(timeState)}
                    </span>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="gemini-cta px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Apply Time
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
