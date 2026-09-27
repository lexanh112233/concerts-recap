import type {Metadata} from "next";
import type {ReactNode} from "react";
import {RootDocument} from "@/components/root-document";
import {siteMetadata} from "@/lib/site-metadata";

// Root layout của trang công khai tiếng Anh (đường dẫn /en; nhóm (site) không hiện trong URL, để cùng cấp với app/en/(admin) có root layout riêng).
// Mỗi ngôn ngữ có root layout riêng để <html lang> và từ điển cố định theo route: trang không cần đọc cookie/header nên vẫn tĩnh (SSG/ISR).
export const metadata: Metadata = siteMetadata("en");

export default function ENLayout({children}: { children: ReactNode }) {
    return <RootDocument lang="en">{children}</RootDocument>;
}
