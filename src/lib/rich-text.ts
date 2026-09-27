// Nhật ký lưu dưới dạng HTML (do trình soạn thảo tạo ra). Dữ liệu cũ là văn bản thường,
// mỗi dòng một đoạn, dòng bắt đầu bằng "- " là gạch đầu dòng.
// File này chỉ có hàm thuần (không phụ thuộc thư viện) nên dùng được cả ở client.

// Nội dung HTML của trình soạn thảo luôn bắt đầu bằng một thẻ khối.
export function isRichBody(body: string) {
    return /^\s*<(p|h[1-6]|ul|ol|blockquote|hr)[\s>/]/i.test(body);
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Văn bản thường kiểu cũ -> HTML (để trình soạn thảo và trang chi tiết dùng chung một định dạng)
export function plainToHtml(text: string) {
    const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
    let html = "";
    let inList = false;
    for (const line of lines) {
        const bullet = /^[-•]\s+(.*)$/.exec(line);
        if (bullet) {
            if (!inList) html += "<ul>";
            inList = true;
            html += `<li><p>${escapeHtml(bullet[1])}</p></li>`;
        } else {
            if (inList) html += "</ul>";
            inList = false;
            html += `<p>${escapeHtml(line)}</p>`;
        }
    }
    return inList ? `${html}</ul>` : html;
}

const ENTITIES: Record<string, string> = {"&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'"};

// HTML -> văn bản thường (dùng cho đoạn trích, mô tả SEO, kiểm tra "có nội dung không")
export function htmlToText(html: string) {
    return html
        .replace(/<\s*(br|\/p|\/h[1-6]|\/li|\/blockquote|hr)\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&(nbsp|amp|lt|gt|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m)
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// Văn bản thường của một nhật ký, dù là HTML hay dữ liệu cũ
export function bodyToText(body: string) {
    return isRichBody(body) ? htmlToText(body) : body.trim();
}
