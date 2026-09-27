import {notFound} from "next/navigation";
import {DetailHero} from "@/components/detail-hero";
import {GalleryProvider} from "@/components/gallery-provider";
import {JournalSheet} from "@/components/journal-sheet";
import {PolaroidDesk} from "@/components/polaroid-desk";
import {Reveal} from "@/components/reveal";
import {ScrollScissors} from "@/components/scroll-scissors";
import {StubNav, type INeighbor} from "@/components/stub-nav";
import {Ticket} from "@/components/ticket";
import {TiltCard} from "@/components/tilt-card";
import type {Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";
import {getConcert, getContext} from "@/lib/concert-data";
import {getMediaList, timeAgo, toCard, weekdayName} from "@/lib/concerts";
import {withRatios} from "@/lib/media-dims";
import {bodyToHtml} from "@/lib/sanitize";
import {getCoverTones} from "@/lib/tone";

// Thân trang chi tiết đêm diễn dùng chung cho hai ngôn ngữ (app/(vi)/concerts/[slug]/page.tsx và app/en/...).
export async function ConcertPage({slug, lang}: { slug: string, lang: Lang }) {
    const t = getDict(lang);
    // hai truy vấn không phụ thuộc nhau nên chạy song song (trước đây nối tiếp, mỗi lượt là một vòng chờ tới Atlas)
    const [concert, context] = await Promise.all([getConcert(slug), getContext(slug)]);
    if (!concert) notFound();

    const {older, newer, number, artistIndex, artistTotal} = context;

    // đo tỉ lệ thật của từng ảnh/video ở server để cỗ bài và bàn ảnh dựng khung đúng hình dạng ngay từ đầu;
    // đồng thời tính tông giấy vé từ màu chủ đạo ảnh bìa của đêm này và hai đêm kề bên (chạy song song)
    const [media, tones] = await Promise.all([
        withRatios(getMediaList(concert.images)),
        getCoverTones([concert, ...[older, newer].filter((n): n is INeighbor => n !== null)]),
    ]);
    const card = toCard(concert, number, tones.get(concert.slug) ?? null, lang);
    const olderStub = older && {...older, tone: tones.get(older.slug)};
    const newerStub = newer && {...newer, tone: tones.get(newer.slug)};
    const ambient = media.find((m) => !m.isVideo)?.src ?? null;
    // bàn ảnh chỉ có khi từ hai ảnh trở lên (một ảnh thì cỗ bài ở hero đã đủ); đánh số các mục theo thứ tự xuất hiện
    const hasDesk = media.length > 1;

    return (
        <GalleryProvider media={media} alt={concert.artistName}>
            <article className='relative isolate overflow-x-clip pb-4'>
                <ScrollScissors/>

                <DetailHero
                    card={card}
                    number={number}
                    ago={timeAgo(concert.date, lang, t.ago)}
                    weekday={weekdayName(concert.date, t.date.weekdays)}
                    artistIndex={artistIndex}
                    artistTotal={artistTotal}
                    ambient={ambient}
                    lang={lang}
                />

                {hasDesk && <PolaroidDesk slug={concert.slug} sectionNo='02'/>}

                <section className='mx-auto grid w-full max-w-[1440px] items-start gap-12 px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:gap-20'>
                    <Reveal>
                        <JournalSheet slug={concert.slug} tone={card.tone} html={bodyToHtml(concert.body)} ticketNo={card.no} sectionNo={hasDesk ? "03" : "02"} lang={lang}/>
                    </Reveal>
                    <div className='lg:sticky lg:top-24'>
                        <Reveal delay={120}>
                            <TiltCard>
                                <Ticket card={card} ticketNo={card.no || null} lang={lang} className='rotate-2'/>
                            </TiltCard>
                        </Reveal>
                    </div>
                </section>

                <Reveal>
                    <StubNav older={olderStub} newer={newerStub} lang={lang}/>
                </Reveal>
            </article>
        </GalleryProvider>
    );
}
