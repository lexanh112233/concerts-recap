// "Buổi Liên Hoan Văn Nghệ - Đầu tiên" -> "buoi-lien-hoan-van-nghe-dau-tien"
export function slugify(input: string, max = 80): string {
    const slug = input
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, max)
        .replace(/-+$/g, "");
    return slug || "su-kien";
}
