// Tâm trạng của một đêm diễn theo điểm 0–5, dùng cho sticker mặt cười trên vé (components/mood-sticker.tsx).
// Thuần và tách riêng để test được: làm tròn và kẹp điểm, chọn góc dán nghiêng của sticker. Dòng chữ viết tay theo điểm
// nằm trong từ điển (dict.mood[stars]) vì phụ thuộc ngôn ngữ.
export interface Mood {
    stars: number
    // độ nghiêng của sticker (độ): mỗi mức một góc cố định nên vé nào cũng dán giống nhau giữa các lần tải
    tilt: number
}

const MOODS: readonly Mood[] = [
    {stars: 0, tilt: -3},
    {stars: 1, tilt: -5},
    {stars: 2, tilt: 4},
    {stars: 3, tilt: 6},
    {stars: 4, tilt: -6},
    {stars: 5, tilt: -8},
];

export function moodFor(rating: number | null | undefined): Mood {
    const rounded = typeof rating === "number" && Number.isFinite(rating) ? Math.round(rating) : 0;
    return MOODS[Math.min(5, Math.max(0, rounded))];
}
