import Link from "next/link";
import connectToDatabase from "@/lib/db";
import diaryEntries from "@/models/diaries";
import {Archive} from "@/components/archive";
import {FeaturedEvent} from "@/components/featured-event";
import {Marquee} from "@/components/marquee";
import {pathFor, type Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";
import {artistKey, sortNewestFirst, ticketNumber, timeAgo, toCard, type IConcert} from "@/lib/concerts";
import {getCoverTones} from "@/lib/tone";

// Thân trang chủ dùng chung cho hai ngôn ngữ (app/(vi)/page.tsx và app/en/page.tsx, mỗi file tự khai revalidate).
export async function HomePage({lang}: { lang: Lang }) {
    const t = getDict(lang);
    await connectToDatabase();
    const docs = (await diaryEntries.find({active: true}).lean()) as unknown as IConcert[];

    // Ngày cũ lưu dạng chuỗi DD.MM.YYYY nên sắp trong JS thay vì .sort() của Mongo
    const sorted = sortNewestFirst(docs);
    // order = thứ tự theo thời gian (cũ nhất là 1), dùng làm số vé
    // màu giấy vé tính từ màu chủ đạo của ảnh bìa (trang này chạy lúc ISR nên không ai phải chờ)
    const tones = await getCoverTones(sorted);
    const cards = sorted.map((c, i) => toCard(c, sorted.length - i, tones.get(c.slug) ?? null, lang));
    const [latest] = sorted;
    const [featured] = cards;

    if (!latest || !featured) {
        return (
            <section className='mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center'>
                <h1 className='font-playfair-display text-4xl font-bold text-white md:text-6xl'>{t.home.emptyTitle}</h1>
                <p className='text-paper/70'>{t.home.emptyNote}</p>
                <Link href={pathFor(lang, "/admin")} className='rounded-full bg-accent px-6 py-3 text-sm font-semibold text-paper'>{t.home.emptyCta}</Link>
            </section>
        );
    }

    // tên nghệ sĩ không trùng, theo thứ tự mới nhất trước
    const artists = new Map<string, { name: string, count: number }>();
    for (const c of sorted) {
        const key = artistKey(c.artistName);
        const entry = artists.get(key);
        if (entry) entry.count += 1;
        else artists.set(key, {name: c.artistName, count: 1});
    }

    return (
        <>
            <FeaturedEvent
                card={featured}
                ticketNo={ticketNumber(latest.date, sorted.length)}
                ago={timeAgo(latest.date, lang, t.ago)}
                lang={lang}
                stats={{
                    shows: sorted.length,
                    artists: artists.size,
                    venues: new Set(cards.map((c) => c.place).filter(Boolean)).size,
                    moments: cards.reduce((sum, c) => sum + c.mediaCount, 0),
                }}
            />
            <Marquee artists={[...artists.values()]} concerts={cards.map(({title, no}) => ({title, no}))} lang={lang}/>
            <Archive items={cards}/>
        </>
    );
}
