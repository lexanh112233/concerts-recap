"use client";

import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {CalendarDays, ChevronLeft, ChevronRight} from "lucide-react";
import {localeTag, type Lang} from "@/i18n/config";
import {useAdminI18n} from "@/i18n/admin/provider";
import {format} from "@/i18n/format";

// ---------- tính ngày ----------
// Toàn bộ dùng giờ địa phương và tự dựng Date(y, m, d): new Date("YYYY-MM-DD") bị hiểu là UTC nên lệch ngày theo múi giờ.

const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function fromValue(value: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    // Date tự "tràn" ngày (31/02 → 03/03): coi là không hợp lệ nếu dựng xong khác đầu vào
    return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

// bề rộng bảng (19rem) và chiều cao ước lượng, để chọn mở xuống dưới hay lên trên ô chọn ngày
const PANEL_WIDTH = 304;
const PANEL_HEIGHT = 420;

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// đổi tháng nhưng kẹp ngày về cuối tháng đích (31/1 + 1 tháng = 28/2, không phải 3/3)
const addMonths = (d: Date, n: number) => {
    const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
    return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), daysInMonth(first.getFullYear(), first.getMonth())));
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
// thứ trong tuần, Thứ hai = 0 … Chủ nhật = 6
const weekdayMon = (d: Date) => (d.getDay() + 6) % 7;

const shortDate = (d: Date, lang: Lang) => d.toLocaleDateString(localeTag(lang), {day: "numeric", month: "long", year: "numeric"});
const fullDate = (d: Date, lang: Lang) => d.toLocaleDateString(localeTag(lang), {weekday: "long", day: "numeric", month: "long", year: "numeric"});
// tên tháng theo ngôn ngữ cho tiêu đề bảng ("Tháng 9 · 2026" dùng số, tiếng Anh dùng tên: "September 2026")
const monthNames = (lang: Lang, month: number) => ({
    n: month + 1,
    name: new Date(2000, month, 1).toLocaleDateString(localeTag(lang), {month: "long"}),
    short: new Date(2000, month, 1).toLocaleDateString(localeTag(lang), {month: "short"}),
});

// Vòng bút đỏ vẽ tay khoanh ngày/tháng đang chọn (cùng ngôn ngữ với số ghế trên vé): nét đứt hở một đoạn, hơi nghiêng.
function PenRing() {
    return (
        <svg
            aria-hidden='true'
            className='pointer-events-none absolute left-[-4px] top-[-3px] h-[calc(100%+6px)] w-[calc(100%+8px)] -rotate-[8deg] overflow-visible text-accent'>
            <ellipse cx='50%' cy='50%' rx='48%' ry='46%' pathLength={100} strokeDasharray='92 8' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'/>
        </svg>
    );
}

function NavButton({label, onClick, children}: { label: string, onClick: () => void, children: ReactNode }) {
    return (
        <button
            type='button'
            aria-label={label}
            title={label}
            onClick={onClick}
            className='flex size-8 shrink-0 items-center justify-center rounded-full text-paper transition-colors hover:bg-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper'>
            {children}
        </button>
    );
}

// Chọn ngày dạng "tờ lịch xé": bảng bật ra là một tờ giấy có dải đỏ tên tháng, hai lỗ đóng gáy, ngày đang chọn khoanh bút đỏ,
// góc dưới gập lại, giống tờ lịch ở hero trang chi tiết. Giá trị gửi lên form là input ẩn `name` dạng YYYY-MM-DD (giữ nguyên
// định dạng cũ nên server không phải đổi). Điều khiển được hoàn toàn bằng bàn phím: mũi tên, Home/End, PageUp/PageDown, Enter, Esc.
export function DatePicker({id, name, defaultValue, invalid, className = "", onChange}: {
    id: string
    name: string
    defaultValue: string
    invalid?: boolean
    className?: string
    // báo ngày vừa chọn (YYYY-MM-DD) cho nơi cần biết ngày ngay khi đổi, vd. gợi ý "đêm này chưa diễn ra"
    onChange?: (value: string) => void
}) {
    const {t, lang} = useAdminI18n();
    const [value, setValue] = useState(defaultValue);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"days" | "months">("days");
    // ngày đang được trỏ tới (bằng bàn phím hoặc lúc mở); tháng đang xem suy ra từ đây
    const [cursor, setCursor] = useState<Date>(() => fromValue(defaultValue) ?? new Date());
    const [browseYear, setBrowseYear] = useState(cursor.getFullYear());
    // Bảng bật ra được đặt bằng position: fixed ở <body> (portal) vì trang giấy của sổ cuộn và cắt mọi thứ tràn ra ngoài nó
    const [place, setPlace] = useState<CSSProperties>({});

    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // chỉ dời focus vào ô ngày khi mở bảng hoặc khi người dùng bấm phím; bấm nút đổi tháng thì giữ focus ở nút
    const focusDay = useRef(false);

    const selected = fromValue(value);

    const openPicker = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) {
            const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
            const room = window.innerHeight - rect.bottom;
            setPlace(room >= PANEL_HEIGHT || room >= rect.top
                ? {left, top: rect.bottom + 8}
                : {left, bottom: window.innerHeight - rect.top + 8});
        }
        setCursor(selected ?? new Date());
        setMode("days");
        focusDay.current = true;
        setOpen(true);
    };

    const close = (returnFocus = false) => {
        setOpen(false);
        if (returnFocus) triggerRef.current?.focus();
    };

    const choose = (day: Date) => {
        setValue(toValue(day));
        onChange?.(toValue(day));
        setCursor(day);
        close(true);
    };

    useEffect(() => {
        if (!open) return;
        const target = (e: Event) => e.target as Node;
        const onPointerDown = (e: PointerEvent) => {
            if (!rootRef.current?.contains(target(e)) && !panelRef.current?.contains(target(e))) setOpen(false);
        };
        // cuộn trang giấy hoặc đổi cỡ cửa sổ thì bảng (đặt cố định) lệch khỏi ô: đóng lại cho gọn
        const onScroll = (e: Event) => {
            if (!panelRef.current?.contains(target(e))) setOpen(false);
        };
        const onResize = () => setOpen(false);
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onResize);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onResize);
        };
    }, [open]);

    useEffect(() => {
        if (!open || mode !== "days" || !focusDay.current) return;
        panelRef.current?.querySelector<HTMLButtonElement>(`[data-day="${toValue(cursor)}"]`)?.focus({preventScroll: true});
    }, [open, mode, cursor]);

    const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close(true);
        }
    };

    const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        let next: Date;
        switch (e.key) {
            case "ArrowLeft": next = addDays(cursor, -1); break;
            case "ArrowRight": next = addDays(cursor, 1); break;
            case "ArrowUp": next = addDays(cursor, -7); break;
            case "ArrowDown": next = addDays(cursor, 7); break;
            case "Home": next = addDays(cursor, -weekdayMon(cursor)); break;
            case "End": next = addDays(cursor, 6 - weekdayMon(cursor)); break;
            case "PageUp": next = addMonths(cursor, e.shiftKey ? -12 : -1); break;
            case "PageDown": next = addMonths(cursor, e.shiftKey ? 12 : 1); break;
            case "Enter":
            case " ":
                e.preventDefault();
                choose(cursor);
                return;
            default:
                return;
        }
        e.preventDefault();
        focusDay.current = true;
        setCursor(next);
    };

    // lưới luôn đủ 6 tuần để bảng không nhảy chiều cao khi đổi tháng
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = addDays(monthStart, -weekdayMon(monthStart));
    const weeks = Array.from({length: 6}, (_, w) => Array.from({length: 7}, (_, d) => addDays(gridStart, w * 7 + d)));
    const today = new Date();

    const stepMonth = (n: number) => {
        focusDay.current = false;
        setCursor(addMonths(cursor, n));
    };

    const pickMonth = (month: number) => {
        focusDay.current = false;
        setCursor(new Date(browseYear, month, Math.min(cursor.getDate(), daysInMonth(browseYear, month))));
        setMode("days");
    };

    return (
        <div ref={rootRef} className='relative'>
            <input type='hidden' name={name} value={value}/>
            <button
                ref={triggerRef}
                id={id}
                type='button'
                aria-haspopup='dialog'
                aria-expanded={open}
                // data-invalid (không dùng aria-invalid vì role button không hỗ trợ) để viền đỏ khi có lỗi
                data-invalid={invalid ? "true" : undefined}
                onClick={() => (open ? close() : openPicker())}
                className={`${className} flex cursor-pointer items-center justify-between gap-2 text-left data-[invalid=true]:border-destructive`}>
                <span className={`truncate ${selected ? "text-ink" : "text-ink/40"}`}>{selected ? shortDate(selected, lang) : t.date.placeholder}</span>
                <CalendarDays className='size-4 shrink-0 text-accent' aria-hidden='true'/>
            </button>

            {open && createPortal(
                <div
                    ref={panelRef}
                    role='dialog'
                    aria-label={t.date.dialog}
                    onKeyDown={onPanelKeyDown}
                    style={place}
                    // drop-shadow ở phần tử bọc vì clip-path của tờ giấy sẽ cắt mất box-shadow
                    className='fixed z-[700] w-[min(19rem,calc(100vw-1rem))] animate-in fade-in-0 slide-in-from-top-1 duration-150 [filter:drop-shadow(0_24px_22px_rgba(0,0,0,0.6))] motion-reduce:animate-none'>
                    <div className='relative overflow-hidden bg-paper text-charcoal [clip-path:polygon(0_0,100%_0,100%_calc(100%-18px),calc(100%-18px)_100%,0_100%)]'>
                        {/* dải đỏ: tên tháng, hai lỗ đóng gáy */}
                        <div className='relative flex items-center justify-between gap-1 bg-accent px-2 pb-2 pt-5 text-paper'>
                            <span aria-hidden='true' className='absolute left-[22%] top-1.5 size-2.5 rounded-full bg-stage shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]'/>
                            <span aria-hidden='true' className='absolute right-[22%] top-1.5 size-2.5 rounded-full bg-stage shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]'/>
                            <NavButton label={mode === "days" ? t.date.prevMonth : t.date.prevYear} onClick={() => (mode === "days" ? stepMonth(-1) : setBrowseYear((y) => y - 1))}>
                                <ChevronLeft className='size-4'/>
                            </NavButton>
                            <button
                                type='button'
                                aria-live='polite'
                                title={mode === "days" ? t.date.pickMonthYear : t.date.backToDays}
                                onClick={() => {
                                    setBrowseYear(cursor.getFullYear());
                                    setMode(mode === "days" ? "months" : "days");
                                }}
                                className='min-w-0 flex-1 truncate rounded px-2 py-1 text-center font-display text-lg font-bold uppercase tracking-[0.16em] transition-colors hover:bg-black/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper'>
                                {mode === "days" ? format(t.date.monthYear, {...monthNames(lang, cursor.getMonth()), year: cursor.getFullYear()}) : browseYear}
                            </button>
                            <NavButton label={mode === "days" ? t.date.nextMonth : t.date.nextYear} onClick={() => (mode === "days" ? stepMonth(1) : setBrowseYear((y) => y + 1))}>
                                <ChevronRight className='size-4'/>
                            </NavButton>
                        </div>

                        {mode === "days" ? (
                            <div className='px-2.5 pb-1.5 pt-3'>
                                <div aria-hidden='true' className='grid grid-cols-7 pb-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-charcoal/60'>
                                    {t.date.weekdaysShort.map((w) => <span key={w}>{w}</span>)}
                                </div>
                                <div role='grid' aria-label={format(t.date.gridLabel, {...monthNames(lang, cursor.getMonth()), year: cursor.getFullYear()})} onKeyDown={onGridKeyDown} className='flex flex-col gap-0.5'>
                                    {weeks.map((week) => (
                                        <div key={toValue(week[0])} role='row' className='grid grid-cols-7'>
                                            {week.map((day) => {
                                                const isSelected = !!selected && sameDay(day, selected);
                                                const isToday = sameDay(day, today);
                                                const inMonth = day.getMonth() === cursor.getMonth();
                                                return (
                                                    <button
                                                        key={toValue(day)}
                                                        type='button'
                                                        role='gridcell'
                                                        data-day={toValue(day)}
                                                        tabIndex={sameDay(day, cursor) ? 0 : -1}
                                                        aria-selected={isSelected}
                                                        aria-current={isToday ? "date" : undefined}
                                                        aria-label={fullDate(day, lang)}
                                                        onClick={() => choose(day)}
                                                        className={`relative mx-auto flex size-9 items-center justify-center rounded-full font-display text-base leading-none outline-none transition-colors hover:bg-charcoal/10 focus-visible:bg-charcoal/10 focus-visible:ring-2 focus-visible:ring-accent ${isSelected ? "font-bold text-accent" : inMonth ? "text-charcoal" : "text-charcoal/30"} ${isToday && !isSelected ? "border border-dashed border-charcoal/55" : ""}`}>
                                                        {day.getDate()}
                                                        {isSelected && <PenRing/>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className='grid grid-cols-3 gap-1.5 px-3 pb-3 pt-4'>
                                {Array.from({length: 12}, (_, m) => {
                                    const isSelected = !!selected && selected.getFullYear() === browseYear && selected.getMonth() === m;
                                    const isCursor = cursor.getFullYear() === browseYear && cursor.getMonth() === m;
                                    return (
                                        <button
                                            key={m}
                                            type='button'
                                            aria-pressed={isSelected}
                                            onClick={() => pickMonth(m)}
                                            className={`relative h-11 rounded-md font-display text-sm uppercase tracking-[0.14em] outline-none transition-colors hover:bg-charcoal/10 focus-visible:ring-2 focus-visible:ring-accent ${isCursor ? "bg-charcoal/10" : ""} ${isSelected ? "font-bold text-accent" : ""}`}>
                                            {format(t.date.monthCell, monthNames(lang, m))}
                                            {isSelected && <PenRing/>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className='flex items-center justify-between border-t border-dashed border-charcoal/30 py-2 pl-3 pr-9'>
                            <button
                                type='button'
                                onClick={() => choose(new Date())}
                                className='font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent underline-offset-4 hover:underline focus-visible:underline'>
                                {t.date.today}
                            </button>
                        </div>

                        {/* góc dưới phải gập lại */}
                        <span aria-hidden='true' className='absolute bottom-0 right-0 size-[18px] bg-gradient-to-br from-white to-[#bcb6a9] [clip-path:polygon(0_0,100%_0,0_100%)]'/>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}
