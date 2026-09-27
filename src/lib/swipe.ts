// Nhận diện cử chỉ vuốt ngang trên trackpad (hoặc lăn ngang chuột) từ chuỗi sự kiện wheel, để lật trang sổ.
// Trackpad Mac không phát MỘT sự kiện cho mỗi cử chỉ mà cả chuỗi: tăng dần khi ngón tay đang vuốt rồi giảm dần theo quán tính, kéo dài tới
// cả giây sau khi nhấc tay. Nên phải gom lại: một cử chỉ = một lần lật, phần quán tính còn lại bị nuốt (và bị chặn để trình duyệt không
// hiểu thành cuộn ngang hay vuốt "quay lại trang trước"). Module thuần: nhận số liệu, trả quyết định, không đụng tới DOM.

// tổng quãng vuốt (px) phải đạt tới mới lật, để cái chạm tay lướt qua không lật nhầm
export const SWIPE_THRESHOLD = 60;
// im lặng chừng này ms thì cử chỉ trước coi như đã kết thúc (quán tính hết) và vuốt tiếp là cử chỉ mới
export const SWIPE_QUIET_MS = 160;
// hướng chủ yếu phải là ngang: |dx| ít nhất bằng chừng này lần |dy|, còn lại là cuộn dọc bình thường của trang
const HORIZONTAL_RATIO = 1.2;

export type SwipeFlip = "next" | "prev";

export interface SwipeResult {
    // sự kiện này là vuốt ngang: nơi gọi nên preventDefault (chặn cuộn ngang và vuốt quay lại của trình duyệt)
    horizontal: boolean
    // lật sang trang kế ("next", vuốt sang trái) hay trang trước ("prev", vuốt sang phải); null nếu chưa lật
    flip: SwipeFlip | null
}

export interface SwipeTracker {
    feed: (dx: number, dy: number, time: number) => SwipeResult
    reset: () => void
}

export function createSwipeTracker(): SwipeTracker {
    let acc = 0;
    let lastTime = Number.NEGATIVE_INFINITY;
    let lastAbs = 0;
    // đã lật trong cử chỉ này: chỉ nuốt tiếp phần quán tính, chưa lật nữa
    let locked = false;

    return {
        feed(dx, dy, time) {
            if (dx === 0 || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return {horizontal: false, flip: null};

            const abs = Math.abs(dx);
            // cử chỉ mới: đã im đủ lâu, hoặc đang trong đuôi quán tính (giảm dần) mà bỗng tăng vọt tức là người dùng vuốt thêm cái nữa
            const fresh = time - lastTime > SWIPE_QUIET_MS || (locked && abs > lastAbs * 1.5 + 10);
            if (fresh) {
                acc = 0;
                locked = false;
            }
            lastTime = time;
            lastAbs = abs;

            if (locked) return {horizontal: true, flip: null};

            acc += dx;
            if (Math.abs(acc) < SWIPE_THRESHOLD) return {horizontal: true, flip: null};

            locked = true;
            const flip: SwipeFlip = acc > 0 ? "next" : "prev";
            acc = 0;
            return {horizontal: true, flip};
        },
        reset() {
            acc = 0;
            lastTime = Number.NEGATIVE_INFINITY;
            lastAbs = 0;
            locked = false;
        },
    };
}
