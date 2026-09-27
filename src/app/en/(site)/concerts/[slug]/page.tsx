import type {Metadata} from "next";
import {ConcertPage} from "@/components/pages/concert-page";
import {concertMetadata, getStaticSlugs} from "@/lib/concert-data";

// Trang được dựng sẵn lúc build và làm mới định kỳ (giống trang chủ) nên bấm vào vé là có ngay, <Link> cũng prefetch được trọn trang.
// Sửa/ẩn/thêm đêm diễn trong /admin sẽ revalidate ngay mọi trang chi tiết (số vé và đêm kề bên của các đêm khác cũng đổi theo).
export const revalidate = 300;

export async function generateStaticParams() {
    return getStaticSlugs();
}

export async function generateMetadata({params}: PageProps<"/en/concerts/[slug]">): Promise<Metadata> {
    const {slug} = await params;
    return concertMetadata("en", slug);
}

export default async function Page({params}: PageProps<"/en/concerts/[slug]">) {
    const {slug} = await params;
    return <ConcertPage slug={slug} lang="en"/>;
}
