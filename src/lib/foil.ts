import type {CSSProperties} from "react";
import {hashString, type ITone} from "@/lib/concerts";

// Tông platinum trung tính: dùng khi vé chưa có tông tính từ ảnh (không có ảnh, ảnh xám, chưa tính được).
const NEUTRAL: ITone = {f1: "#ffffff", f2: "#e7e9ef", f3: "#bfc4cf", glow: "#b9d4ff"};

// Giấy vé kiểu platinum: ba màu (sáng, giữa, đậm) cho gradient chéo nhẹ + màu vầng sáng (glow) quanh vé.
// Màu lấy từ màu chủ đạo của ảnh bìa (tone, tính ở server bằng lib/tone.ts) nên vé ăn màu với ảnh của nó;
// thẻ, vé ở hero và vé ở trang chi tiết của cùng một sự kiện dùng cùng một tone nên luôn cùng màu.
export function foilStyle(seed: string, tone?: ITone | null): CSSProperties {
    const t = tone ?? NEUTRAL;
    // --tw (giây) lệch pha nhịp phát sáng của kim tuyến (.glitter) và vầng sáng (.aura) để các vé không sáng lên cùng lúc
    const tw = ((hashString(seed) >>> 7) % 70) / 10;
    return {"--f1": t.f1, "--f2": t.f2, "--f3": t.f3, "--glow": t.glow, "--tw": tw} as CSSProperties;
}
