"use client";

import {useMemo, useState, useSyncExternalStore} from "react";
import {ArchiveFilters, type View} from "@/components/archive-filters";
import {Reveal} from "@/components/reveal";
import {TicketCard} from "@/components/ticket-card";
import {localeTag} from "@/i18n/config";
import {plural} from "@/i18n/format";
import {useI18n} from "@/i18n/provider";
import type {ICard} from "@/lib/concerts";
import {normalizeText} from "@/lib/text";

// Kiểu hiển thị được nhớ trong localStorage. useSyncExternalStore giúp lần render đầu (server) luôn là "grid"
// rồi mới chuyển sang giá trị đã lưu, không lệch HTML giữa server và client.
const VIEW_KEY = "nkan:view";
const VIEW_EVENT = "nkan:view-change";
let memoryView: View = "grid";

function subscribeView(callback: () => void) {
    window.addEventListener("storage", callback);
    window.addEventListener(VIEW_EVENT, callback);
    return () => {
        window.removeEventListener("storage", callback);
        window.removeEventListener(VIEW_EVENT, callback);
    };
}

function getView(): View {
    try {
        return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "grid";
    } catch {
        return memoryView;
    }
}

function saveView(view: View) {
    memoryView = view;
    try {
        localStorage.setItem(VIEW_KEY, view);
    } catch {
        // trình duyệt chặn lưu trữ: chỉ nhớ trong phiên này
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
}

export function Archive({items}: { items: ICard[] }) {
    const {lang, t} = useI18n();
    const [year, setYear] = useState<number | "all">("all");
    const [place, setPlace] = useState<string>("all");
    const [query, setQuery] = useState("");
    const view = useSyncExternalStore(subscribeView, getView, () => "board" as View);
    const board = view === "board";

    const years = useMemo(
        () => [...new Set(items.map((i) => i.year).filter((y): y is number => y !== null))].sort((a, b) => b - a),
        [items],
    );
    const places = useMemo(() => {
        const count = new Map<string, number>();
        for (const i of items) if (i.place) count.set(i.place, (count.get(i.place) ?? 0) + 1);
        return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], localeTag(lang)));
    }, [items, lang]);

    const filtered = useMemo(() => {
        const q = normalizeText(query.trim());
        return items.filter((i) =>
            (year === "all" || i.year === year)
            && (place === "all" || i.place === place)
            && (!q || normalizeText(`${i.title} ${i.artistName} ${i.place ?? ""} ${i.city ?? ""} ${i.companion}`).includes(q)));
    }, [items, year, place, query]);

    // items đã sắp mới nhất trước nên nhóm theo năm giữ nguyên thứ tự
    const groups = useMemo(() => {
        const map = new Map<number | null, ICard[]>();
        for (const card of filtered) map.set(card.year, [...(map.get(card.year) ?? []), card]);
        return [...map.entries()];
    }, [filtered]);

    const filtering = year !== "all" || place !== "all" || query.trim() !== "";
    const reset = () => {
        setYear("all");
        setPlace("all");
        setQuery("");
    };

    return (
        <section id='archive' className='mx-auto w-full max-w-[1440px] scroll-mt-20 px-4 py-20 sm:px-6 md:px-10'>
            <header className='grid gap-x-12 gap-y-10 overflow-x-clip lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start'>
                <div className='flex flex-col gap-3'>
                    <p className='flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-accent'>
                        <span className='text-paper/40'>01</span>
                        {t.archive.kicker}
                    </p>
                    <h2 className='font-playfair-display text-4xl font-bold text-white md:text-6xl lg:max-w-[12ch] lg:text-balance lg:text-7xl'>{t.archive.title}</h2>
                </div>

                <ArchiveFilters
                    query={query}
                    onQuery={setQuery}
                    years={years}
                    year={year}
                    onYear={setYear}
                    places={places}
                    place={place}
                    onPlace={setPlace}
                    view={view}
                    onView={saveView}
                    filtering={filtering}
                    onReset={reset}
                    resultCount={filtered.length}
                />
            </header>

            {groups.length === 0 ? (
                <div className='mt-14 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/20 px-6 py-16 text-center'>
                    <p className='font-playfair-display text-2xl text-white'>{t.archive.empty}</p>
                    <button type='button' onClick={reset} className='text-sm text-accent hover:underline'>{t.archive.clear}</button>
                </div>
            ) : groups.map(([groupYear, cards]) => (
                <div key={groupYear ?? "unknown"} className='mt-14 first:mt-10'>
                    <div className='mb-8 flex items-end gap-4 border-b border-dashed border-white/15 pb-4'>
                        <span className='text-stroke font-be-vietnam-pro text-[clamp(64px,12vw,160px)] font-bold leading-[0.85]'>
                            {groupYear ?? t.archive.otherYear}
                        </span>
                        <span className='pb-2 text-sm text-paper/60'>{plural(lang, t.archive.nights, cards.length)}</span>
                    </div>
                    {board ? (
                        <div className='board overflow-x-clip rounded-2xl border border-dashed border-white/15 bg-[#0d0d0d] px-4 pb-16 pt-10 sm:px-8'>
                            <div className='grid grid-cols-1 gap-x-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
                                {cards.map((card, i) => (
                                    <Reveal key={card.slug} delay={(i % 5) * 60} className='-mb-8 sm:-mb-10 [&:nth-child(even)]:sm:mt-10'>
                                        <TicketCard card={card} variant='board'/>
                                    </Reveal>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className='grid grid-cols-1 gap-x-8 gap-y-14 px-1 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                            {cards.map((card, i) => (
                                <Reveal key={card.slug} delay={(i % 4) * 70}>
                                    <TicketCard card={card}/>
                                </Reveal>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </section>
    );
}
