import type {Metadata} from "next";
import {RootDocument} from "@/components/root-document";
import {siteMetadata} from "@/lib/site-metadata";

// Root layout của trang công khai tiếng Việt (nhóm (vi) không hiện trong URL nên là "/").
// Mỗi ngôn ngữ có root layout riêng để <html lang> và từ điển cố định theo route: trang không cần đọc cookie/header nên vẫn tĩnh (SSG/ISR).
export const metadata: Metadata = siteMetadata("vi");

export default function VILayout({children}: LayoutProps<"/">) {
    return <RootDocument lang="vi">{children}</RootDocument>;
}
