import type {Metadata} from "next";
import {pathFor, type Lang} from "@/i18n/config";
import {getDict} from "@/i18n/server";
import {BRAND_NAME} from "@/lib/brand";

const SITE_NAME = BRAND_NAME;

// Địa chỉ gốc của site để Next ghép các đường dẫn tương đối (canonical, hreflang, ảnh OG): tên miền production hoặc bản deploy
// hiện tại trên Vercel (biến hệ thống có sẵn), dự phòng localhost khi chạy máy.
export function siteUrl(): URL {
    const host = process.env.VERCEL_ENV === "production"
        ? process.env.VERCEL_PROJECT_PRODUCTION_URL
        : process.env.VERCEL_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
    return new URL(host ? `https://${host}` : "http://localhost:3000");
}

const OG_LOCALE: Record<Lang, string> = {vi: "vi_VN", en: "en_US"};

// Metadata mặc định của root layout theo ngôn ngữ
export function siteMetadata(lang: Lang): Metadata {
    return {
        metadataBase: siteUrl(),
        title: {default: SITE_NAME, template: `%s · ${SITE_NAME}`},
        description: getDict(lang).meta.description,
        openGraph: {siteName: SITE_NAME, locale: OG_LOCALE[lang], type: "website"},
    };
}

// canonical + hreflang cho một đường dẫn công khai (path tính theo tiếng Việt, ví dụ "/" hay "/concerts/x")
export function alternatesFor(lang: Lang, path: string): NonNullable<Metadata["alternates"]> {
    return {
        canonical: pathFor(lang, path),
        languages: {vi: pathFor("vi", path), en: pathFor("en", path), "x-default": pathFor("vi", path)},
    };
}

export function homeMetadata(lang: Lang): Metadata {
    return {alternates: alternatesFor(lang, "/")};
}
