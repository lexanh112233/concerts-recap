"use client";

import Link from "next/link";
import {useId, useRef, useState, type CSSProperties, type ComponentProps} from "react";
import {useFormStatus} from "react-dom";
import {Cloud, ExternalLink, Eye, EyeOff, ImageOff, Pencil, Play, Plus, X} from "lucide-react";
import {toggleActiveAction} from "@/app/admin/actions";
import {Book, type BookHandle} from "@/components/admin/book/book";
import {BookCover} from "@/components/admin/book/cover";
import {DeleteEventButton} from "@/components/admin/delete-event-button";
import {LoginCover} from "@/components/admin/login-form";
import {SavedNote} from "@/components/admin/saved-note";
import {SmartMedia} from "@/components/smart-media";
import {
    computeStats,
    filterRows,
    formatVndShort,
    pageOfSlug,
    paginate,
    sortRows,
    yearTabs,
    type AdminFilter,
    type AdminRow,
    type AdminSort,
    type AdminStats,
} from "@/lib/admin-list";
import {pathFor} from "@/i18n/config";
import {useAdminI18n} from "@/i18n/admin/provider";
import {format, plural} from "@/i18n/format";
import {hashString} from "@/lib/concerts";

const FOCUS_RING = "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const SORT_KEYS: Record<AdminSort, "sortNewest" | "sortOldest" | "sortPrice" | "sortNet"> = {
    newest: "sortNewest",
    oldest: "sortOldest",
    price: "sortPrice",
    net: "sortNet",
};
const SORT_ORDER: AdminSort[] = ["newest", "oldest", "price", "net"];

// Băng nhãn Dymo bấm được: đen, chữ nổi; đang chọn thì đỏ và nhô lên (cùng kiểu bộ lọc ở trang lưu trữ công khai)
function Dymo({active = false, tilt, className = "", style, children, ...props}: ComponentProps<"button"> & { active?: boolean, tilt: number }) {
    return (
        <button
            type='button'
            aria-pressed={active}
            style={{...style, "--tilt": `${tilt}deg`} as CSSProperties}
            className={`dymo relative inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-[3px] px-2 py-2 font-mono text-[11px] font-bold uppercase leading-[1.35] tracking-[0.1em] text-white outline-hidden transition-[rotate,translate] duration-200 [rotate:var(--tilt)] hover:[rotate:0deg] focus-visible:[rotate:0deg] motion-reduce:transition-none ${FOCUS_RING} ${active ? "dymo-up -translate-y-1 [--dymo:var(--brand)]" : ""} ${className}`}
            {...props}>
            {children}
        </button>
    );
}

// Giấy nhớ dán băng dính chứa một con số
function Note({tone, tilt, value, label, sub}: { tone: "yellow" | "cream" | "brand" | "kraft", tilt: number, value: string, label: string, sub?: string }) {
    const tones = {
        yellow: "bg-[#f1de8a] text-ink",
        cream: "bg-[#fbf3df] text-ink ring-1 ring-ink/10",
        brand: "bg-accent text-paper",
        kraft: "bg-[#d3b083] text-ink",
    };
    return (
        <li
            style={{rotate: `${tilt}deg`}}
            className={`relative flex min-h-[92px] flex-col justify-between px-3 pb-2 pt-3.5 shadow-[0_10px_14px_-8px_rgba(38,30,20,0.7)] ${tones[tone]}`}>
            <span aria-hidden='true' className='tape absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 -rotate-[3deg] opacity-90'/>
            <span className='font-display text-[1.75rem] font-bold leading-none tracking-wide'>{value}</span>
            <span className='flex flex-col gap-0.5'>
                <span className='font-playpen-sans text-[13px] font-semibold leading-tight'>{label}</span>
                {sub && <span className='font-playpen-sans text-[11px] leading-tight opacity-75'>{sub}</span>}
            </span>
        </li>
    );
}

function HideButton({active}: { active: boolean }) {
    const {pending} = useFormStatus();
    const {t} = useAdminI18n();
    // nhãn là HÀNH ĐỘNG sẽ xảy ra: đang hiện thì bấm để ẩn khỏi trang chủ, đang ẩn thì bấm để hiện lên. Chuyện ẩn/hiện không liên quan tới "sắp diễn ra" (suy ra từ ngày)
    const label = active ? t.list.hide : t.list.show;
    return (
        <button
            type='submit'
            disabled={pending}
            aria-label={label}
            title={label}
            className={`flex size-6 cursor-pointer items-center justify-center rounded-md text-ink/65 transition-colors hover:bg-ink/10 hover:text-ink disabled:opacity-40 @md:size-7 ${FOCUS_RING}`}>
            {active ? <EyeOff className='size-4'/> : <Eye className='size-4'/>}
        </button>
    );
}

// bốn nút nhỏ ở cuối mỗi dòng (xem, sửa, ẩn/hiện, xoá): hẹp thì 24px để còn chỗ cho số tiền, rộng thì 28px
const ICON_LINK = `flex size-6 items-center justify-center rounded-md text-ink/65 transition-colors hover:bg-ink/10 hover:text-ink @md:size-7 ${FOCUS_RING}`;

function RowItem({row, saved}: { row: AdminRow, saved: boolean }) {
    const {t, lang} = useAdminI18n();
    // độ nghiêng cố định theo slug: mỗi tấm ảnh lệch một kiểu nhưng không đổi giữa các lần tải
    const tilt = ((hashString(row.slug) % 7) - 3) * 0.9;
    return (
        <li
            id={row.slug}
            className={`flex items-center gap-3.5 rounded-sm px-1.5 py-2.5 ${saved ? "flash-highlight" : ""} ${row.active ? "" : "opacity-60"}`}>
            <div
                style={{rotate: `${tilt}deg`}}
                className='relative size-[58px] shrink-0 bg-white p-[3px] pb-[10px] shadow-[0_5px_8px_-3px_rgba(38,30,20,0.6)] @md:size-[64px]'>
                <div className='relative size-full overflow-hidden bg-[#e3dac4]'>
                    {row.cover ? (
                        <SmartMedia media={row.cover} alt='' sizes='64px' className='absolute inset-0'/>
                    ) : (
                        <div className='flex size-full items-center justify-center text-ink/35'><ImageOff className='size-4'/></div>
                    )}
                    {row.cover?.isVideo && (
                        <span className='pointer-events-none absolute bottom-0.5 left-0.5 flex size-4 items-center justify-center rounded-full bg-black/65'>
                            <Play className='size-2 fill-white text-white'/>
                        </span>
                    )}
                </div>
            </div>

            <div className='min-w-0 flex-1'>
                {/* đang ẩn: biểu tượng mắt gạch ở đầu dòng tiêu đề (dòng số tiền đã có nhãn "Sắp diễn ra" + 3 nút nên không còn chỗ cho nó ở màn hình hẹp) */}
                <div className='flex min-w-0 items-center gap-1.5'>
                    {!row.active && (
                        <span role='img' aria-label={t.list.hiddenBadge} title={t.list.hiddenBadge} className='flex shrink-0 items-center text-ink/55'>
                            <EyeOff className='size-3.5'/>
                        </span>
                    )}
                    <p title={row.title} className={`min-w-0 truncate font-playfair-display text-[17px] font-semibold leading-snug ${row.active ? "" : "line-through decoration-ink/40"}`}>{row.title}</p>
                </div>
                <p className='truncate font-playpen-sans text-[12.5px] text-ink/65'>
                    {row.artistName} · {row.dateLabel || t.list.noDate}
                </p>
                {/* dòng cuối: số tiền (+ nhãn "sắp diễn ra") bên trái, ba nút bên phải. Chỗ hẹp mà có nhãn thì nhãn xuống dưới số tiền thay vì nuốt mất số tiền */}
                <div className='flex items-center justify-between gap-2'>
                    <p className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink/55'>
                        {row.netLabel ? (
                            <>
                                <span className='truncate @md:hidden'>{row.netShort}</span>
                                <span className='hidden truncate @md:inline'>{row.netLabel}</span>
                            </>
                        ) : (
                            <span className='truncate'>{t.list.noPrice}</span>
                        )}
                        {row.upcoming && <span className='dymo shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em] text-white'>{t.list.upcomingBadge}</span>}
                    </p>
                    <div className='-mr-1 flex shrink-0 items-center @md:-mr-1.5'>
                        <Link href={pathFor(lang, `/concerts/${row.slug}`)} aria-label={format(t.list.viewPublic, {title: row.title})} title={t.list.viewShort} className={ICON_LINK}>
                            <ExternalLink className='size-4'/>
                        </Link>
                        <Link href={pathFor(lang, `/admin/${row.slug}/edit`)} aria-label={format(t.list.edit, {title: row.title})} title={t.list.editShort} className={ICON_LINK}>
                            <Pencil className='size-4'/>
                        </Link>
                        <form action={toggleActiveAction}>
                            <input type='hidden' name='slug' value={row.slug}/>
                            <input type='hidden' name='active' value={String(!row.active)}/>
                            <HideButton active={row.active}/>
                        </form>
                        <DeleteEventButton slug={row.slug} title={row.title} variant='icon'/>
                    </div>
                </div>
            </div>
        </li>
    );
}

function ListPage({rows, number, total, saved, empty, onClear}: {
    rows: AdminRow[]
    number: number
    total: number
    saved?: string
    empty: boolean
    onClear: () => void
}) {
    const {t, lang} = useAdminI18n();
    return (
        <section aria-label={format(t.list.pageLabel, {n: number})} className='flex min-h-full flex-col'>
            <header className='mb-1 flex items-baseline justify-between border-b-2 border-ink/80 pb-2'>
                <h2 className='font-display text-2xl font-bold uppercase tracking-[0.12em]'>{t.list.nightsHeading}</h2>
                <span className='font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55'>{number}/{total}</span>
            </header>

            {empty ? (
                <div className='flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center'>
                    <p className='font-playpen-sans text-lg'>{t.list.empty}</p>
                    <p className='font-playpen-sans text-sm text-ink/60'>{t.list.emptyHint}</p>
                    <Dymo tilt={-1.5} onClick={onClear}>{t.list.clearFilters}</Dymo>
                </div>
            ) : (
                <ul className='divide-y divide-dashed divide-ink/25'>
                    {rows.map((row) => <RowItem key={row.slug} row={row} saved={row.slug === saved}/>)}
                </ul>
            )}

            {number === total && !empty && (
                <Link
                    href={pathFor(lang, "/admin/new")}
                    className={`mt-4 flex items-center justify-center gap-2 border-2 border-dashed border-ink/35 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink/60 transition-colors hover:border-accent hover:text-accent ${FOCUS_RING}`}>
                    <Plus className='size-4'/>
                    {t.list.add}
                </Link>
            )}
        </section>
    );
}

function SearchStrip({value, onChange}: { value: string, onChange: (value: string) => void }) {
    const {t} = useAdminI18n();
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    return (
        <div className={`dymo flex items-center gap-3 rounded-[3px] px-3 py-2.5 font-mono text-[11px] font-bold uppercase leading-[1.35] tracking-[0.14em] text-white outline-hidden transition-[rotate] duration-200 [rotate:-0.8deg] focus-within:[rotate:0deg] focus-within:outline-solid focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent motion-reduce:transition-none`}>
            <label htmlFor={id} className='shrink-0 cursor-text text-paper/70'>{t.list.search}</label>
            <input
                id={id}
                ref={input}
                type='search'
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t.list.searchPlaceholder}
                autoComplete='off'
                className='min-w-0 flex-1 bg-transparent uppercase tracking-[0.14em] text-white caret-paper outline-hidden placeholder:text-paper/40 [&::-webkit-search-cancel-button]:hidden'
            />
            {value && (
                <button
                    type='button'
                    aria-label={t.list.clearSearch}
                    onClick={() => {
                        onChange("");
                        input.current?.focus();
                    }}
                    className={`shrink-0 cursor-pointer text-paper/70 outline-hidden transition-colors hover:text-white ${FOCUS_RING}`}>
                    <X className='size-3.5'/>
                </button>
            )}
        </div>
    );
}

function TocPage({stats, query, filter, sort, r2, shown, onQuery, onFilter, onSort}: {
    stats: AdminStats
    query: string
    filter: AdminFilter
    sort: AdminSort
    r2: boolean
    // số đêm đang hiện sau khi lọc
    shown: number
    onQuery: (q: string) => void
    onFilter: (f: AdminFilter) => void
    onSort: (s: AdminSort) => void
}) {
    const {t, lang} = useAdminI18n();
    const sortId = useId();
    // "Đã diễn ra"/"Sắp diễn ra" theo NGÀY, "Đang ẩn" theo công tắc hiển thị: hai chuyện khác nhau nên số đếm có thể chồng nhau
    const filters: Array<{ value: AdminFilter, label: string, count: number, tilt: number }> = [
        {value: "all", label: t.list.filterAll, count: stats.nights, tilt: -1.4},
        {value: "happened", label: t.list.filterHappened, count: stats.nights - stats.upcoming, tilt: 1.1},
        {value: "upcoming", label: t.list.filterUpcoming, count: stats.upcoming, tilt: -0.8},
        {value: "hidden", label: t.list.filterHidden, count: stats.hidden, tilt: 1.3},
    ];
    const narrowed = query.trim() !== "" || filter !== "all";

    return (
        <section aria-label={t.list.contents} className='flex min-h-full flex-col gap-5'>
            <header className='flex flex-col gap-1'>
                <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
                    <p className='whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-accent'>{t.list.kicker}</p>
                    <Link
                        href={pathFor(lang, "/admin/new")}
                        className={`relative flex items-center gap-1.5 whitespace-nowrap bg-accent px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-paper shadow-[0_6px_10px_-5px_rgba(120,40,10,0.85)] transition-[rotate] duration-200 [rotate:1.4deg] hover:[rotate:0deg] focus-visible:[rotate:0deg] motion-reduce:transition-none ${FOCUS_RING}`}>
                        <Plus className='size-3.5'/>
                        {t.list.add}
                    </Link>
                </div>
                <h1 className='font-playfair-display text-[2rem] font-bold leading-tight'>{t.list.title}</h1>
                <p className='font-playpen-sans text-sm text-ink/60'>{t.list.subtitle}</p>
            </header>

            <ul className='grid grid-cols-2 gap-x-3.5 gap-y-4 px-1 @md:grid-cols-4' aria-label={t.list.stats}>
                <Note tone='yellow' tilt={-2.2} value={String(stats.nights)} label={t.list.nights}/>
                <Note tone='cream' tilt={1.6} value={String(stats.artists)} label={t.list.artists}/>
                <Note
                    tone='brand'
                    tilt={-1.2}
                    value={formatVndShort(stats.spent, lang)}
                    label={t.list.spent}
                    sub={stats.missingPrice > 0 ? plural(lang, t.list.spentMissing, stats.missingPrice) : t.list.spentAll}
                />
                <Note tone='kraft' tilt={2} value={String(stats.upcoming)} label={t.list.upcoming}/>
            </ul>

            <div className='flex flex-col gap-3.5'>
                <SearchStrip value={query} onChange={onQuery}/>
                <div className='flex flex-wrap gap-x-2 gap-y-2.5' role='group' aria-label={t.list.filters}>
                    {filters.map((f) => (
                        <Dymo key={f.value} tilt={f.tilt} active={filter === f.value} onClick={() => onFilter(f.value)}>
                            {f.label}
                            <span className='opacity-60'>{f.count}</span>
                        </Dymo>
                    ))}
                </div>
                <div className='flex items-center gap-3'>
                    <label htmlFor={sortId} className='shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink/60'>{t.list.sortBy}</label>
                    <select
                        id={sortId}
                        value={sort}
                        onChange={(e) => onSort(e.target.value as AdminSort)}
                        className={`min-w-0 flex-1 cursor-pointer border-0 border-b border-ink/40 bg-transparent py-1 font-playpen-sans text-[13.5px] text-ink outline-hidden ${FOCUS_RING}`}>
                        {SORT_ORDER.map((value) => <option key={value} value={value}>{t.list[SORT_KEYS[value]]}</option>)}
                    </select>
                </div>
                {narrowed && (
                    <p className='font-playpen-sans text-[13px] text-ink/65' aria-live='polite'>
                        {format(t.list.showing, {shown, total: stats.nights})}
                    </p>
                )}
            </div>

            <div className='mt-auto flex flex-col gap-2.5 pt-3'>
                <p className='font-playpen-sans text-[13px] leading-snug text-ink/50'>{t.list.tip}</p>
                <p className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${r2 ? "text-ink/50" : "text-[#9a4d00]"}`}>
                    <Cloud className='size-3.5 shrink-0'/>
                    {r2 ? t.list.r2Ok : t.list.r2Missing}
                </p>
            </div>
        </section>
    );
}

// Bìa mở chậm hơn một lần lật trang thường: đây là khoảnh khắc "mở sổ" nên cho nó thong thả
const UNLOCK_OPEN_MS = 1400;

interface AdminBookProps {
    rows: AdminRow[]
    saved?: string
    r2: boolean
    // sổ còn khoá (chưa đăng nhập): bìa đóng, mật khẩu điền trên nhãn bìa, chưa có trang nào có nội dung
    locked?: boolean
    // server đã có ADMIN_PASSWORD chưa (chỉ dùng khi khoá; chưa có thì thay ô mật khẩu bằng lời nhắc cấu hình)
    configured?: boolean
    // vừa xoá xong một sự kiện: mốc thời gian của lần xoá (mỗi lần một giấy nhớ mới) và số file R2 chưa xoá được
    deleted?: string
    leftover?: number
}

// Sổ quản trị: trang đầu là mục lục (số liệu, tìm kiếm, lọc, sắp xếp), các trang sau là danh sách 5 đêm mỗi trang, tab năm ở mép sổ.
// Vỏ ngoài chỉ lo một việc: đăng xuất ngay trên trang này thì server gửi lại cùng trang với `locked` = true, lúc đó dựng lại cả sổ
// (key mới) để bìa đóng lại từ đầu với ô mật khẩu trắng, thay vì giữ nguyên sổ đang mở rồi đóng nó lại giữa chừng.
export function AdminBook(props: AdminBookProps) {
    const locked = props.locked ?? false;
    const [epoch, setEpoch] = useState(0);
    const [wasLocked, setWasLocked] = useState(locked);
    if (locked !== wasLocked) {
        setWasLocked(locked);
        if (locked) setEpoch((n) => n + 1);
    }
    return <Notebook key={epoch} {...props}/>;
}

function Notebook({rows, saved, r2, locked = false, configured = true, deleted, leftover}: AdminBookProps) {
    const {t} = useAdminI18n();
    // Sổ được dựng ở trạng thái khoá thì giữ nguyên ô mật khẩu trên bìa suốt thời gian bìa mở ra (đúng mật khẩu rồi `locked` mới thành false,
    // nếu bỏ ô mật khẩu ngay lúc đó thì nhãn bìa đổi hình giữa lúc đang lật). Sổ dựng ở trạng thái đã mở thì bìa trơn.
    const [startedLocked] = useState(locked);
    const book = useRef<BookHandle>(null);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<AdminFilter>("all");
    const [sort, setSort] = useState<AdminSort>("newest");
    // trang mở tới sau khi bìa mở: trang danh sách chứa đêm vừa lưu (mặc định chưa lọc, xếp mới nhất trước), còn không thì mục lục
    const [initialPage] = useState(() => {
        const index = saved ? pageOfSlug(sortRows(rows, "newest"), saved) : -1;
        return index < 0 ? 0 : index + 1;
    });

    const stats = computeStats(rows);
    const shownRows = sortRows(filterRows(rows, {query, filter}), sort);
    const chunks = paginate(shownRows);
    // tab năm chỉ có nghĩa khi xếp theo ngày (xếp theo giá thì năm nằm lẫn lộn)
    const tabs = [
        {label: t.list.contents, page: 0},
        ...(sort === "newest" || sort === "oldest" ? yearTabs(shownRows).map((tab) => ({label: String(tab.year), page: tab.page + 1})) : []),
    ];

    // đổi tìm kiếm/lọc/sắp xếp thì về trang đầu (mục lục), nơi các ô điều khiển nằm
    const change = <T,>(set: (value: T) => void) => (value: T) => {
        set(value);
        book.current?.goTo(0);
    };
    const clear = () => {
        setQuery("");
        setFilter("all");
        book.current?.goTo(0);
    };

    // sổ khoá: hai trang trống, chỉ để bìa mở ra có gì bên dưới; nội dung thật đến cùng lúc với việc mở khoá
    const pages = locked ? [<div key='toc'/>, <div key='list-0'/>] : [
        <TocPage
            key='toc'
            stats={stats}
            query={query}
            filter={filter}
            sort={sort}
            r2={r2}
            shown={shownRows.length}
            onQuery={change(setQuery)}
            onFilter={change(setFilter)}
            onSort={change(setSort)}
        />,
        ...chunks.map((chunk, i) => (
            <ListPage
                key={`list-${i}`}
                rows={chunk}
                number={i + 1}
                total={chunks.length}
                saved={saved}
                empty={shownRows.length === 0}
                onClear={clear}
            />
        )),
    ];

    return (
        <>
            <Book
                ref={book}
                label={t.list.bookLabel}
                cover={<BookCover>{startedLocked && <LoginCover configured={configured}/>}</BookCover>}
                pages={pages}
                initialPage={initialPage}
                locked={locked}
                openMs={startedLocked ? UNLOCK_OPEN_MS : undefined}
                tabs={locked ? undefined : tabs}
                tagLabel={t.list.contentsBack}
                tagText={t.list.contents}
            />
            {saved && <SavedNote slug={saved}/>}
            {deleted && <SavedNote key={deleted} kind='deleted' leftover={leftover}/>}
        </>
    );
}
