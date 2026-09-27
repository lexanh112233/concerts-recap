// Host ảnh/video được phép dùng (next/image, kiểm tra URL lúc lưu, server tự tải ảnh để đo/tính màu): CHỈ host của R2_PUBLIC_URL,
// tức địa chỉ công khai của bucket do chính bạn cấu hình. Chưa đặt R2_PUBLIC_URL thì không host nào được phép (chưa dùng ảnh/video được).
// next.config.ts dùng lại hàm này nên hai bên luôn khớp nhau.
export function allowedMediaHosts(): string[] {
    const hosts = new Set<string>();
    try {
        if (process.env.R2_PUBLIC_URL) hosts.add(new URL(process.env.R2_PUBLIC_URL).hostname);
    } catch {
        // R2_PUBLIC_URL sai định dạng thì bỏ qua
    }
    return [...hosts];
}

export function isAllowedMediaUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && allowedMediaHosts().includes(url.hostname);
    } catch {
        return false;
    }
}

// Chỉ file nằm THẲNG trong hai thư mục này của bucket mới được server tự xoá khi xoá một sự kiện: diary-images/ (mọi lần tải lên từ admin,
// gồm cả video) và diary-videos/ (video cũ). Không nhận thư mục lồng: xoá file R2 không hoàn tác được nên không đoán.
// (Đường dẫn có `..` hay `%2e%2e` đã bị `new URL` rút gọn trước khi tới đây, nên rơi ra ngoài hai thư mục và bị loại.)
const DELETABLE_KEY = /^(diary-images|diary-videos)\/[^/]+$/;

// Từ URL công khai của các file media suy ra key trong bucket để xoá. `publicBases` là các địa chỉ công khai của bucket
// (R2_PUBLIC_URL, có thể kèm đường dẫn); URL không thuộc địa chỉ nào trong đó, không phải https,
// hoặc key không khớp đúng dạng trên thì bị bỏ qua (không bao giờ xoá thứ mình không chắc). Loại trùng.
export function mediaKeysToDelete(urls: readonly string[], publicBases: readonly string[]): string[] {
    const bases: URL[] = [];
    for (const base of publicBases) {
        try {
            const url = new URL(base);
            if (url.protocol === "https:") bases.push(url);
        } catch {
            // địa chỉ cấu hình sai định dạng thì bỏ qua
        }
    }

    const keys = new Set<string>();
    for (const value of urls) {
        let url: URL;
        try {
            url = new URL(value);
        } catch {
            continue;
        }
        if (url.protocol !== "https:") continue;

        for (const base of bases) {
            if (base.host !== url.host) continue;
            const prefix = base.pathname.replace(/\/+$/, "");
            if (!url.pathname.startsWith(`${prefix}/`)) continue;

            let key: string;
            try {
                key = decodeURIComponent(url.pathname.slice(prefix.length + 1));
            } catch {
                break;
            }
            if (DELETABLE_KEY.test(key)) keys.add(key);
            break;
        }
    }
    return [...keys];
}
