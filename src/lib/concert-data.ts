import "server-only";
import {cache} from "react";
import type {Metadata} from "next";
import type {INeighbor} from "@/components/stub-nav";
import type {Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";
import connectToDatabase from "@/lib/db";
import {alternatesFor} from "@/lib/site-metadata";
import diaryEntries from "@/models/diaries";
import {artistKey, excerpt, getMediaList, sortNewestFirst, type IConcert} from "@/lib/concerts";

// Dữ liệu trang chi tiết đêm diễn, dùng chung cho hai ngôn ngữ (app/(vi)/concerts/[slug] và app/en/concerts/[slug]).

// DB lỗi lúc build thì trả mảng rỗng (bắt buộc luôn là một mảng): các trang sẽ được dựng ở lần vào đầu tiên rồi cache, không làm hỏng cả bản build.
export async function getStaticSlugs(): Promise<Array<{ slug: string }>> {
    try {
        await connectToDatabase();
        const entries = (await diaryEntries.find({active: true}).select("slug").lean()) as unknown as Array<{ slug: string }>;
        return entries.map(({slug}) => ({slug}));
    } catch (error) {
        console.error("Không lấy được danh sách đêm diễn để dựng sẵn:", error);
        return [];
    }
}

export const getConcert = cache(async (slug: string) => {
    await connectToDatabase();
    return (await diaryEntries
        .findOne({slug, active: true})
        .lean()) as unknown as IConcert | null;
});

// Ngày trong DB có thể là chuỗi "DD.MM.YYYY" nên không query $lt/$gt được (mongoose cast lỗi);
// lấy danh sách gọn rồi sắp xếp trong JS.
export async function getContext(slug: string) {
    // tự kết nối (bufferCommands tắt): hàm này chạy song song với getConcert nên không được trông chờ getConcert đã kết nối xong
    await connectToDatabase();
    const entries = (await diaryEntries
        .find({active: true})
        .select("slug title artistName date images")
        .lean()) as unknown as INeighbor[];

    const newestFirst = sortNewestFirst(entries);
    const index = newestFirst.findIndex((e) => e.slug === slug);
    if (index === -1) return {older: null, newer: null, number: 0, artistIndex: 0, artistTotal: 0};

    const key = artistKey(newestFirst[index].artistName);
    const sameArtist = [...newestFirst].reverse().filter((e) => artistKey(e.artistName) === key);

    return {
        newer: newestFirst[index - 1] ?? null,
        older: newestFirst[index + 1] ?? null,
        // thứ tự của đêm diễn này tính từ cũ nhất, dùng làm số vé
        number: newestFirst.length - index,
        artistIndex: sameArtist.findIndex((e) => e.slug === slug) + 1,
        artistTotal: sameArtist.length,
    };
}

export async function concertMetadata(lang: Lang, slug: string): Promise<Metadata> {
    const concert = await getConcert(slug);
    if (!concert) return {title: getDict(lang).notFound.concertMetaTitle};

    const cover = getMediaList(concert.images).find((m) => !m.isVideo);
    return {
        title: concert.title,
        description: excerpt(concert.body, 160),
        alternates: alternatesFor(lang, `/concerts/${slug}`),
        openGraph: cover ? {images: [cover.src]} : undefined,
    };
}
