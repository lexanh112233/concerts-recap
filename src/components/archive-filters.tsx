"use client";

import {useEffect, useId, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type KeyboardEvent} from "react";
import {ChevronDown, LayoutGrid, MapPin, Pin, X} from "lucide-react";
import {plural} from "@/i18n/format";
import {useI18n} from "@/i18n/provider";
import {normalizeText} from "@/lib/text";

export type View = "grid" | "board";

// Góc xoay cố định theo chỉ số (không ngẫu nhiên) nên server và client render giống hệt nhau, không lệch hydration.
const TILTS = [-2, 1.6, -1, 2.2, -1.6, 1.2, -2.4, 0.8];
const tiltAt = (index: number) => TILTS[index % TILTS.length];

// Vòng focus bàn phím màu accent. outline-hidden của Tailwind v4 đặt outline-style: none nên phải bật lại solid lúc focus,
// nếu chỉ đổi màu thì vẫn không có viền nào hiện ra.
const FOCUS_RING = "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Băng nhãn Dymo bấm được: đen, chữ nổi; đang chọn thì đỏ và nhô lên. Mỗi dải xoay một góc riêng, rê chuột hoặc focus thì xoay thẳng.
function Dymo({active = false, tilt, small = false, className = "", style, children, ...props}: ComponentProps<"button"> & {
    active?: boolean
    tilt: number
    small?: boolean
}) {
    return (
        <button
            type='button'
            style={{...style, "--tilt": `${tilt}deg`} as CSSProperties}
            className={`dymo relative inline-flex max-w-full items-center gap-2 rounded-[3px] font-mono font-bold uppercase leading-[1.35] tracking-[0.14em] text-white outline-hidden transition-[rotate,translate] duration-200 [rotate:var(--tilt)] hover:[rotate:0deg] focus-visible:[rotate:0deg] motion-reduce:transition-none ${FOCUS_RING} ${small ? "px-2.5 py-2 text-[11px]" : "px-3.5 py-2.5 text-xs"} ${active ? "dymo-up -translate-y-1 [--dymo:var(--brand)]" : ""} ${className}`}
            {...props}>
            {children}
        </button>
    );
}

// Dải tìm kiếm: chính ô nhập là băng Dymo, chữ gõ vào hiện in hoa (giá trị thật vẫn giữ nguyên).
function SearchStrip({value, onChange}: { value: string, onChange: (value: string) => void }) {
    const {t} = useI18n();
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    return (
        <div className='dymo flex items-center gap-3 rounded-[3px] px-3.5 py-2.5 font-mono text-xs font-bold uppercase leading-[1.35] tracking-[0.14em] text-white outline-hidden transition-[rotate] duration-200 [rotate:-1.2deg] focus-within:[rotate:0deg] focus-within:outline-solid focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent motion-reduce:transition-none'>
            <label htmlFor={id} className='shrink-0 cursor-text text-paper/70'>{t.filters.search}</label>
            <input
                id={id}
                ref={input}
                type='search'
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t.filters.searchPlaceholder}
                autoComplete='off'
                className='min-w-0 flex-1 bg-transparent uppercase tracking-[0.14em] text-white caret-paper outline-hidden placeholder:text-paper/40 [&::-webkit-search-cancel-button]:hidden'
            />
            {value && (
                <button
                    type='button'
                    aria-label={t.filters.clearSearch}
                    onClick={() => {
                        onChange("");
                        input.current?.focus();
                    }}
                    className={`shrink-0 text-paper/70 outline-hidden transition-colors hover:text-white focus-visible:text-white ${FOCUS_RING}`}>
                    <X className='size-3.5'/>
                </button>
            )}
        </div>
    );
}

// Chọn địa điểm: bấm dải Dymo thì mở "cuộn nhãn" gồm các dải Dymo nhỏ. Listbox có bàn phím đầy đủ:
// ↑ ↓ Home End di chuyển, Enter/Space chọn, Esc đóng và trả focus, gõ chữ đầu để nhảy tới mục, bấm ra ngoài để đóng.
function PlacePicker({places, value, onChange}: {
    places: Array<[string, number]>
    value: string
    onChange: (value: string) => void
}) {
    const {t} = useI18n();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const typed = useRef({text: "", at: 0});
    const listId = useId();

    const options = useMemo(
        () => [{value: "all", label: t.filters.allPlaces, count: null as number | null}, ...places.map(([name, count]) => ({value: name, label: name, count}))],
        [places, t.filters.allPlaces],
    );
    const selected = Math.max(0, options.findIndex((o) => o.value === value));
    const current = options[selected];

    const close = (returnFocus: boolean) => {
        setOpen(false);
        if (returnFocus) trigger.current?.focus();
    };
    const show = () => {
        setActive(selected);
        setOpen(true);
    };
    const choose = (index: number) => {
        onChange(options[index].value);
        close(true);
    };

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (!root.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open]);

    useEffect(() => {
        if (open) list.current?.focus({preventScroll: true});
    }, [open]);

    // giữ mục đang chọn trong vùng nhìn thấy của danh sách mà không cuộn cả trang
    useEffect(() => {
        const box = list.current;
        const el = box?.querySelector<HTMLElement>(`[data-index="${active}"]`);
        if (!open || !box || !el) return;
        if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop - 8;
        else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight + 8;
    }, [open, active]);

    const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const last = options.length - 1;
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActive((i) => Math.min(last, i + 1));
                return;
            case "ArrowUp":
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
                return;
            case "Home":
                e.preventDefault();
                setActive(0);
                return;
            case "End":
                e.preventDefault();
                setActive(last);
                return;
            case "Enter":
            case " ":
                e.preventDefault();
                choose(active);
                return;
            case "Escape":
                e.preventDefault();
                e.stopPropagation();
                close(true);
                return;
            case "Tab":
                setOpen(false);
                return;
        }
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

        // gõ nhanh nhiều chữ thì ghép lại; một chữ lặp lại thì đi vòng qua các mục cùng chữ đầu
        const buffer = typed.current;
        buffer.text = e.timeStamp - buffer.at < 700 ? buffer.text + e.key : e.key;
        buffer.at = e.timeStamp;
        const query = normalizeText(buffer.text);
        const from = buffer.text.length === 1 ? active + 1 : active;
        for (let n = 0; n < options.length; n++) {
            const i = (from + n) % options.length;
            if (normalizeText(options[i].label).startsWith(query)) {
                setActive(i);
                return;
            }
        }
    };

    const label = value === "all" ? current.label : `${current.label} · ${current.count}`;

    return (
        <div ref={root} className='relative'>
            <Dymo
                ref={trigger}
                tilt={1}
                active={value !== "all"}
                title={label}
                aria-haspopup='listbox'
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                onClick={() => (open ? close(false) : show())}
                onKeyDown={(e) => {
                    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                        e.preventDefault();
                        show();
                    }
                }}>
                <MapPin className='size-3.5 shrink-0'/>
                <span className='min-w-0 truncate'>{label}</span>
                <ChevronDown className={`size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}/>
            </Dymo>
            {open && (
                <div
                    ref={list}
                    id={listId}
                    role='listbox'
                    tabIndex={-1}
                    aria-label={t.filters.byPlace}
                    aria-activedescendant={`${listId}-${active}`}
                    onKeyDown={onListKeyDown}
                    className='absolute left-0 top-[calc(100%+10px)] z-30 flex max-h-64 w-full flex-col gap-1.5 overflow-y-auto rounded-[3px] bg-paper p-2 shadow-[0_18px_26px_-10px_rgba(0,0,0,0.7)] outline-hidden ring-1 ring-charcoal/20'>
                    {options.map((o, i) => (
                        <div
                            key={o.value}
                            id={`${listId}-${i}`}
                            data-index={i}
                            role='option'
                            aria-selected={i === selected}
                            onPointerMove={() => i !== active && setActive(i)}
                            onClick={() => choose(i)}
                            className={`dymo flex shrink-0 cursor-pointer items-center justify-between gap-3 rounded-[3px] px-3 py-2 font-mono text-[11px] font-bold uppercase leading-[1.35] tracking-[0.14em] text-white ${i === selected ? "dymo-up [--dymo:var(--brand)]" : ""} ${i === active ? "outline-2 outline-offset-1 outline-charcoal" : ""}`}>
                            <span className='min-w-0 truncate'>{o.label}</span>
                            {o.count !== null && <span className='shrink-0 text-paper/70'>{o.count}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Kiểu hiển thị: hai dải Dymo nhỏ chỉ có icon (tên đọc cho trình đọc màn hình qua aria-label)
export function ViewToggle({view, onChange}: { view: View, onChange: (view: View) => void }) {
    const {t} = useI18n();
    const options = [
        {value: "board", label: t.filters.board, icon: Pin, tilt: -1.6},
        {value: "grid", label: t.filters.grid, icon: LayoutGrid, tilt: 1.4},
    ] as const;
    return (
        <div role='radiogroup' aria-label={t.filters.viewLabel} className='flex gap-2.5'>
            {options.map(({value, label, icon: Icon, tilt}) => (
                <Dymo
                    key={value}
                    small
                    role='radio'
                    aria-checked={view === value}
                    aria-label={label}
                    title={label}
                    active={view === value}
                    tilt={tilt}
                    onClick={() => onChange(value)}>
                    <Icon className='size-4'/>
                </Dymo>
            ))}
        </div>
    );
}

// Tờ giấy note dán băng dính, trên đó dán các nhãn Dymo: tìm kiếm, năm, địa điểm, kiểu hiển thị.
export function ArchiveFilters({query, onQuery, years, year, onYear, places, place, onPlace, view, onView, filtering, onReset, resultCount}: {
    query: string
    onQuery: (value: string) => void
    years: number[]
    year: number | "all"
    onYear: (year: number | "all") => void
    places: Array<[string, number]>
    place: string
    onPlace: (place: string) => void
    view: View
    onView: (view: View) => void
    filtering: boolean
    onReset: () => void
    resultCount: number
}) {
    const {lang, t} = useI18n();
    return (
        // z-30: danh sách địa điểm mở ra phải nằm trên các tấm vé bên dưới (vé z 1–5), nhưng vẫn dưới thanh header (z-40)
        <div className='relative z-30 w-full max-w-md rotate-1 justify-self-center md:max-w-xl md:justify-self-end lg:max-w-[28rem] lg:rotate-[1.5deg]'>
            <span aria-hidden='true' className='tape absolute -top-3 left-[8%] z-10 h-6 w-[4.5rem] -rotate-[8deg]'/>
            <span aria-hidden='true' className='tape absolute -top-2 right-[9%] z-10 h-6 w-16 rotate-[7deg]'/>
            <div className='flex flex-col gap-5 rounded-[3px] bg-ticket-stock px-5 pb-5 pt-8 shadow-[0_18px_28px_-12px_rgba(0,0,0,0.85)] sm:px-6'>
                <SearchStrip value={query} onChange={onQuery}/>

                <div role='group' aria-label={t.filters.byYear} className='flex flex-wrap items-center gap-x-2.5 gap-y-3 px-0.5'>
                    <Dymo tilt={tiltAt(0)} active={year === "all"} aria-pressed={year === "all"} onClick={() => onYear("all")}>{t.filters.allYears}</Dymo>
                    {years.map((y, i) => (
                        <Dymo key={y} tilt={tiltAt(i + 1)} active={year === y} aria-pressed={year === y} onClick={() => onYear(y)}>{y}</Dymo>
                    ))}
                </div>

                {places.length > 1 && <PlacePicker places={places} value={place} onChange={onPlace}/>}

                <div className='flex items-center justify-between gap-3'>
                    <ViewToggle view={view} onChange={onView}/>
                    <button
                        type='button'
                        onClick={onReset}
                        className={`-rotate-2 bg-paper px-3 py-1.5 font-playpen-sans text-sm text-charcoal shadow-[0_2px_4px_rgba(0,0,0,0.3)] outline-hidden transition-[rotate] duration-200 hover:rotate-0 focus-visible:rotate-0 motion-reduce:transition-none ${FOCUS_RING} ${filtering ? "" : "invisible"}`}>
                        {t.filters.peel} <X className='inline size-3.5 align-[-2px] text-accent'/>
                    </button>
                </div>

                <p className='sr-only' aria-live='polite'>{filtering ? plural(lang, t.archive.matches, resultCount) : ""}</p>
            </div>
        </div>
    );
}
