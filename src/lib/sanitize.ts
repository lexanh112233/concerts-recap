import sanitizeHtml from "sanitize-html";
import {isRichBody, plainToHtml} from "@/lib/rich-text";

// Chỉ dùng ở server. Lọc HTML nhật ký theo danh sách cho phép: chặn script, sự kiện on*,
// javascript: và mọi thẻ/thuộc tính không có trong trình soạn thảo.
const OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ["p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "hr"],
    allowedAttributes: {
        a: ["href", "target", "rel"],
        p: ["style"],
        h2: ["style"],
        h3: ["style"],
    },
    allowedStyles: {
        "*": {"text-align": [/^(left|center|right)$/]},
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
        // dán từ Word/web hay mang theo các thẻ tương đương
        b: "strong",
        i: "em",
        strike: "s",
        del: "s",
        h1: "h2",
        h4: "h3",
        h5: "h3",
        h6: "h3",
        a: sanitizeHtml.simpleTransform("a", {rel: "noopener noreferrer nofollow", target: "_blank"}),
    },
};

export function sanitizeBody(html: string) {
    return sanitizeHtml(html, OPTIONS);
}

// HTML an toàn để hiển thị/soạn thảo, kể cả với nhật ký cũ dạng văn bản thường
export function bodyToHtml(body: string) {
    return sanitizeBody(isRichBody(body) ? body : plainToHtml(body));
}
