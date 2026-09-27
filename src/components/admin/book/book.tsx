"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type CSSProperties,
    type ReactNode,
} from "react";
import {useAdminI18n} from "@/i18n/admin/provider";
import {format} from "@/i18n/format";
import {createSwipeTracker} from "@/lib/swipe";

// Cuốn sổ của trang quản trị: các "mặt giấy" (face) lật thật quanh gáy bằng CSS 3D.
//
// Mô hình vật lý: mặt 0 là bìa trước, mặt 1 là mặt trong của bìa (trang đầu tiên của bạn), mặt 2 là mặt trước tờ thứ nhất...
// Mỗi tờ (leaf) có hai mặt: mặt chẵn (trước, nằm bên phải khi chưa lật) và mặt lẻ (sau, nằm bên trái khi đã lật).
//   - Máy tính (≥1024px): hai trang một lúc. `view` = số tờ đã lật; hiện mặt 2·view−1 (trái) và 2·view (phải).
//   - Nhỏ hơn: một trang một lúc, mỗi mặt là một tờ riêng lật khỏi sổ về bên trái. `view` = chỉ số mặt đang hiện.
//
// Mọi trang chỉ nằm MỘT LẦN trong DOM (cùng key, cùng vị trí trong cây) ở cả hai chế độ và khi đổi cỡ cửa sổ: chỉ CSS/animation đổi,
// nên các ô đang gõ dở trong form không bao giờ bị dựng lại.
//
// Lúc nghỉ, mặt nào đang hiện nằm PHẲNG (không transform, nên chữ nét, bấm trúng, popup không bị cắt); chỉ tờ đang lật mới dùng
// transform 3D, chạy bằng Web Animations API rồi trả về trạng thái phẳng. Mặt không hiện thì `visibility: hidden` + `inert`.

export interface BookTab {
    label: string
    // chỉ số trang (từ 0, theo mảng `pages`) tab này mở tới
    page: number
    // đánh dấu cần chú ý (vd. trang có ô nhập bị lỗi)
    flag?: boolean
}

export interface BookHandle {
    goTo: (page: number) => void
}

const DOUBLE_QUERY = "(min-width: 1024px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const OPENED_KEY = "kds-book-opened";

const FLIP_MS = 880;
const STAGGER_MS = 150;
// bìa tự mở sau chừng này ms khi vào lần đầu trong phiên, để người dùng kịp thấy cuốn sổ còn đóng
const OPEN_DELAY_MS = 450;

const subscribeMode = (onChange: () => void) => {
    const mq = window.matchMedia(DOUBLE_QUERY);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
};
const getMode = () => window.matchMedia(DOUBLE_QUERY).matches;
// máy chủ và lần hydrate đầu chưa biết cỡ màn hình; cuốn sổ ẩn cho tới khi mount xong nên không thấy khung hình sai
const getServerMode = () => false;

const isEditable = (el: EventTarget | null) => {
    if (!(el instanceof HTMLElement)) return false;
    return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
};

// Trong khối đang lăn có phần tử nào còn cuộn ngang được theo hướng `dx` không (vd. khối JSON trong hướng dẫn CORS)? Có thì để nó tự cuộn,
// đừng cướp cử chỉ đó để lật trang.
function scrollsHorizontally(target: EventTarget | null, root: HTMLElement, dx: number): boolean {
    for (let el = target instanceof HTMLElement ? target : null; el && el !== root; el = el.parentElement) {
        if (el.scrollWidth <= el.clientWidth + 1) continue;
        const overflowX = getComputedStyle(el).overflowX;
        if (overflowX !== "auto" && overflowX !== "scroll") continue;
        if (dx > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0) return true;
    }
    return false;
}

// Các mặt đang hiện khi ở `view`
function visibleFaces(view: number, double: boolean): number[] {
    if (!double) return [view];
    return view === 0 ? [0] : [2 * view - 1, 2 * view];
}

// Nhóm mặt đổi trạng thái (lật đi/lật về) khi chuyển từ view `from` sang `to`, theo thứ tự lật.
// Máy tính: mỗi tờ là một nhóm hai mặt. Điện thoại: mỗi mặt là một nhóm.
function turningGroups(from: number, to: number, double: boolean): number[][] {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const groups: number[][] = [];
    for (let i = lo; i < hi; i++) groups.push(double ? [2 * i, 2 * i + 1] : [i]);
    return to > from ? groups : groups.reverse();
}

interface Running {
    gen: number
    animations: Animation[]
    marked: HTMLElement[]
}

export const Book = forwardRef<BookHandle, {
    label: string
    cover: ReactNode
    pages: ReactNode[]
    // trang mở tới sau khi bìa mở (mặc định 0)
    initialPage?: number
    tabs?: BookTab[]
    // thẻ treo dây ở gáy dưới (kéo để về trang 0): tên cho trình đọc màn hình và chữ in trên thẻ
    tagLabel?: string
    tagText?: string
    // dải dưới sổ, cùng bề rộng với sổ (vd. nút Hủy/Lưu của form)
    footer?: ReactNode
    // Sổ khoá (chưa đăng nhập): luôn bắt đầu ở trạng thái đóng, không tự mở, bấm bìa/phím/vuốt/góc trang đều không mở hay lật được.
    // Chuyển `locked` từ true sang false (đúng mật khẩu) thì bìa mở ra ngay tại chỗ, tới `initialPage`; các trang đã có nội dung thật từ trước lúc đó.
    locked?: boolean
    // thời gian (ms) bìa mở ra; các lần lật trang sau đó luôn nhanh hơn. Mặc định bằng một lần lật trang
    openMs?: number
    className?: string
}>(function Book({label, cover, pages, initialPage = 0, tabs, tagLabel, tagText, footer, locked = false, openMs = FLIP_MS, className = ""}, ref) {
    const {t} = useAdminI18n();
    const double = useSyncExternalStore(subscribeMode, getMode, getServerMode);
    // null: chưa khởi tạo (chưa mount) — sổ ẩn. -1: bìa đóng. 0..n-1: trang đang xem (ở chế độ hai trang là một trong hai trang của cặp)
    const [rawPage, setRawPage] = useState<number | null>(null);
    // đang khởi tạo: tắt transition để sổ hiện ngay ở đúng chỗ (không trượt từ vị trí đóng)
    const [instant, setInstant] = useState(true);
    const faceRefs = useRef<(HTMLDivElement | null)[]>([]);
    const running = useRef<Running | null>(null);
    const generation = useRef(0);
    const prev = useRef({view: 0, double});
    const skipNext = useRef(false);
    const root = useRef<HTMLDivElement>(null);
    // vuốt ngang trên trackpad: gom cả chuỗi sự kiện wheel (kèm quán tính) của một lần vuốt thành một lần lật
    const swipe = useRef(createSwipeTracker());
    // vừa giật dây thẻ treo: chạy hoạt hoạ giật dây một lần
    const [pulled, setPulled] = useState(false);
    const pullTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const count = pages.length;
    const maxPage = count - 1;
    // các mặt của sổ: bìa, các trang, và một mặt trắng lót nếu số mặt lẻ (để tờ cuối đủ hai mặt)
    const faces: ReactNode[] = [cover, ...pages];
    if (faces.length % 2 === 1) faces.push(null);

    const page = rawPage === null ? -1 : rawPage < 0 ? -1 : Math.min(rawPage, maxPage);
    const open = page >= 0;
    const view = !open ? 0 : double ? Math.floor(page / 2) + 1 : page + 1;
    const maxView = double ? Math.ceil(count / 2) : count;
    const shown = new Set(visibleFaces(view, double));

    // ---- khởi tạo sau khi mount: đã mở bìa trong phiên này thì vào thẳng trang; chưa thì để bìa đóng rồi tự mở ----
    useEffect(() => {
        // sổ khoá: luôn đóng, không đọc cờ "đã mở", không tự mở
        if (locked) {
            const lockedTimer = setTimeout(() => {
                setRawPage(-1);
                setInstant(false);
            }, 0);
            return () => clearTimeout(lockedTimer);
        }
        let opened = false;
        try {
            opened = sessionStorage.getItem(OPENED_KEY) === "1";
        } catch {
            // sessionStorage bị chặn: coi như chưa mở
        }

        // setTimeout (không dùng requestAnimationFrame): tab chạy nền không gọi rAF, sổ sẽ kẹt ở trạng thái ẩn tới khi tab hiện ra
        let openTimer: ReturnType<typeof setTimeout> | undefined;
        let settleTimer: ReturnType<typeof setTimeout> | undefined;
        const initTimer = setTimeout(() => {
            if (opened) {
                skipNext.current = true;
                setRawPage(initialPage);
            } else {
                setRawPage(-1);
                openTimer = setTimeout(() => {
                    try {
                        sessionStorage.setItem(OPENED_KEY, "1");
                    } catch {
                        // không lưu được thì lần sau bìa mở lại, không sao
                    }
                    setRawPage(initialPage);
                }, OPEN_DELAY_MS);
            }
            // chờ vài khung hình rồi mới bật lại transition, để bước khởi tạo không bị coi là một chuyển động
            settleTimer = setTimeout(() => setInstant(false), 60);
        }, 0);
        return () => {
            clearTimeout(initTimer);
            clearTimeout(openTimer);
            clearTimeout(settleTimer);
        };
        // chỉ chạy một lần khi mount; initialPage thay đổi sau đó không được kéo sổ về trang khác
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const goTo = useCallback((target: number) => {
        setRawPage((current) => {
            if (current === null) return current;
            return Math.min(Math.max(target, 0), maxPage);
        });
        try {
            sessionStorage.setItem(OPENED_KEY, "1");
        } catch {
            // bỏ qua
        }
    }, [maxPage]);

    useImperativeHandle(ref, () => ({goTo}), [goTo]);

    // Mở khoá (đăng nhập đúng): bìa mở ra ngay tại chỗ. Server đã gửi nội dung thật cùng lúc với việc mở khoá nên không có chặng chờ nào giữa bìa mở và danh sách
    const wasLocked = useRef(locked);
    useEffect(() => {
        const unlocked = wasLocked.current && !locked;
        wasLocked.current = locked;
        if (unlocked) goTo(initialPage);
    }, [locked, initialPage, goTo]);

    useEffect(() => () => clearTimeout(pullTimer.current), []);

    const pullTag = () => {
        clearTimeout(pullTimer.current);
        setPulled(true);
        pullTimer.current = setTimeout(() => setPulled(false), 520);
        goTo(0);
    };

    // Trang kế/trước theo chế độ: hai trang thì nhảy nguyên cặp
    const step = (dir: 1 | -1) => {
        if (!open || locked) return;
        const next = double ? (Math.floor(page / 2) + dir) * 2 : page + dir;
        if (next < 0 || next > maxPage) return;
        goTo(next);
    };
    const canPrev = open && (double ? Math.floor(page / 2) > 0 : page > 0);
    const canNext = open && (double ? view < maxView : page < maxPage);

    // ---- lật: chạy khi `view` đổi (không chạy khi đổi chế độ hoặc ở lần khởi tạo cần bỏ qua) ----
    useLayoutEffect(() => {
        const before = prev.current;
        prev.current = {view, double};
        if (before.double !== double || before.view === view) return;
        if (skipNext.current) {
            skipNext.current = false;
            return;
        }
        if (window.matchMedia(REDUCED_QUERY).matches) return;

        // tờ đang lật dở bị chốt luôn về đích trước khi bắt đầu lượt mới
        if (running.current) {
            running.current.animations.forEach((a) => a.cancel());
            running.current.marked.forEach((el) => {
                delete el.dataset.turning;
                delete el.dataset.under;
                delete el.dataset.was;
            });
            running.current = null;
        }

        const groups = turningGroups(before.view, view, double);
        // mở bìa (từ sổ đóng ra) có thể chậm hơn lật trang thường
        const duration = before.view === 0 ? openMs : FLIP_MS;
        const forward = view > before.view;
        const turningFaces = new Set(groups.flat());
        const marked: HTMLElement[] = [];
        const animations: Animation[] = [];
        const gen = ++generation.current;

        // mặt đang hiện lúc bắt đầu lật giữ nếp gấp góc trang của nó trong suốt lúc lật (nếp gấp lật theo tờ giấy)
        for (const j of visibleFaces(before.view, double)) {
            const el = faceRefs.current[j];
            if (el) {
                el.dataset.was = "";
                marked.push(el);
            }
        }

        // mặt nằm dưới tờ đang lật (trang cũ sắp bị che, trang mới sắp lộ ra) phải hiện suốt lúc lật
        for (const j of [...visibleFaces(before.view, double), ...visibleFaces(view, double)]) {
            const el = faceRefs.current[j];
            if (el && !turningFaces.has(j)) {
                el.dataset.under = "";
                marked.push(el);
            }
        }

        groups.forEach((group, rank) => {
            const zStart = 100 - rank;
            const zEnd = 100 + rank;
            for (const j of group) {
                const el = faceRefs.current[j];
                if (!el) continue;
                el.dataset.turning = "";
                marked.push(el);

                // mặt sau của tờ (số lẻ) ở chế độ hai trang có gáy ở cạnh phải của nó, nên xoay bù 180° so với mặt trước
                const back = double && j % 2 === 1;
                const [from, to] = back ? (forward ? [180, 0] : [0, 180]) : (forward ? [0, -180] : [-180, 0]);
                // ở chế độ một trang tờ đã lật văng ra ngoài mép sổ nên mờ dần để không "biến mất" đột ngột.
                // z-index đổi ở giữa quãng (lúc tờ đứng thẳng, mép hướng vào mắt): trước đó tờ nằm trên chồng bên nguồn,
                // sau đó nằm trên chồng bên đích. Thuộc tính không nêu ở một mốc thì tự nội suy giữa các mốc có nêu.
                const fade = !double;
                const frames: Keyframe[] = [
                    {offset: 0, transform: `rotateY(${from}deg)`, zIndex: zStart, opacity: forward || !fade ? 1 : 0},
                    ...(fade && !forward ? [{offset: 0.4, opacity: 1}] : []),
                    {offset: 0.5, zIndex: zStart},
                    {offset: 0.5001, zIndex: zEnd},
                    ...(fade && forward ? [{offset: 0.6, opacity: 1}] : []),
                    {offset: 1, transform: `rotateY(${to}deg)`, zIndex: zEnd, opacity: forward && fade ? 0 : 1},
                ];
                // fill "both": sau khi chạy xong tờ giữ nguyên tư thế cuối cho tới khi ta gỡ cờ hiện (bên dưới) rồi mới cancel,
                // nếu không sẽ có một khung hình mặt trước lộ ra nằm phẳng trước khi bị ẩn
                animations.push(el.animate(frames, {
                    duration,
                    delay: rank * STAGGER_MS,
                    easing: "cubic-bezier(0.55, 0.05, 0.25, 1)",
                    fill: "both",
                }));

                const shade = el.querySelector<HTMLElement>("[data-shade]");
                const shadeAnimation = shade?.animate(
                    [{opacity: 0}, {opacity: 0.5, offset: 0.5}, {opacity: 0}],
                    {duration, delay: rank * STAGGER_MS, easing: "cubic-bezier(0.55, 0.05, 0.25, 1)", fill: "both"},
                );
                if (shadeAnimation) animations.push(shadeAnimation);
            }
        });

        running.current = {gen, animations, marked};
        Promise.allSettled(animations.map((a) => a.finished)).then(() => {
            // một lượt lật mới đã thay thế lượt này (và đã tự dọn) thì bỏ qua
            if (running.current?.gen !== gen) return;
            marked.forEach((el) => {
                delete el.dataset.turning;
                delete el.dataset.under;
                delete el.dataset.was;
            });
            animations.forEach((a) => a.cancel());
            running.current = null;
        });
    }, [view, double, openMs]);

    // ---- phím mũi tên (không cướp phím khi đang gõ) ----
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (locked || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isEditable(e.target)) return;
            // đang ở trong một hộp thoại (vd. xác nhận xoá) thì mũi tên không được lật cuốn sổ phía sau nó
            if (e.target instanceof Element && e.target.closest("dialog")) return;
            if (e.key === "ArrowRight") step(1);
            else if (e.key === "ArrowLeft") step(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    // ---- vuốt ngang trên trackpad (Mac) hoặc lăn ngang chuột: lật trang ----
    // Lắng nghe cả vùng <main> quanh cuốn sổ (không chỉ riêng tờ giấy) để vuốt lệch ra mép bàn cũng lật chứ không bị trình duyệt hiểu
    // thành "quay lại trang trước". Phải là listener native không thụ động: React đăng ký onWheel ở dạng thụ động nên không chặn được.
    useEffect(() => {
        const book = root.current;
        if (!book || locked) return;
        const area = book.closest("main") ?? book;
        const onWheel = (e: WheelEvent) => {
            // ctrl + wheel là cử chỉ chụm ngón để phóng to; dạng dòng/trang (chuột cũ) đổi ra px xấp xỉ
            if (e.ctrlKey || e.defaultPrevented || rawPage === null) return;
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
            const dx = e.deltaX * unit;
            if (scrollsHorizontally(e.target, area as HTMLElement, dx)) return;

            const {horizontal, flip} = swipe.current.feed(dx, e.deltaY * unit, e.timeStamp);
            if (!horizontal) return;
            e.preventDefault();
            if (!flip) return;
            // sổ đang đóng: vuốt sang trái là lật bìa mở ra; vuốt ngược lại thì không có gì để lật
            if (!open) {
                if (flip === "next") goTo(initialPage);
                return;
            }
            step(flip === "next" ? 1 : -1);
        };
        area.addEventListener("wheel", onWheel, {passive: false});
        return () => area.removeEventListener("wheel", onWheel);
    });

    // Mỗi tab phủ các trang từ trang của nó tới trước trang của tab kế; tab "đang chọn" nếu phủ ít nhất một trang đang hiện
    // (hai trang một lúc thì một cặp có thể phủ hai tab, vd. cuối năm này và đầu năm sau)
    const shownLo = double ? Math.floor(page / 2) * 2 : page;
    const shownHi = double ? shownLo + 1 : page;
    const isActiveTab = (i: number) => {
        if (!open || !tabs) return false;
        const end = tabs[i + 1]?.page ?? Infinity;
        return tabs[i].page <= shownHi && end > shownLo;
    };

    const tabButtons = tabs?.map((tab, i) => (
        <button
            key={`${tab.label}-${i}`}
            type='button'
            className='bk-tab'
            data-active={isActiveTab(i) ? "" : undefined}
            data-flag={tab.flag ? "" : undefined}
            aria-current={isActiveTab(i) ? "page" : undefined}
            style={{"--i": i} as CSSProperties}
            onClick={() => goTo(tab.page)}>
            {tab.label}
            {tab.flag && <span className='bk-tab-flag' aria-label={t.book.flag}>!</span>}
        </button>
    ));

    return (
        <div
            ref={root}
            role='group'
            aria-roledescription={t.book.roleDescription}
            aria-label={label}
            className={`bk ${className}`}
            data-mode={double ? "double" : "single"}
            data-open={open ? "" : undefined}
            data-can-next={canNext ? "" : undefined}
            data-can-prev={canPrev ? "" : undefined}
            data-ready={rawPage !== null ? "" : undefined}
            data-instant={instant ? "" : undefined}
            data-locked={locked ? "" : undefined}
            style={{"--bk-open": `${openMs}ms`} as CSSProperties}>
            <div className='bk-book'>
                <span aria-hidden='true' className='bk-board bk-board-l'/>
                <span aria-hidden='true' className='bk-board bk-board-r'/>

                {faces.map((content, j) => {
                    const isCover = j === 0;
                    const spine = double ? (j % 2 === 0 ? "left" : "right") : "left";
                    const visible = shown.has(j);
                    return (
                        <div
                            key={j}
                            ref={(el) => {
                                faceRefs.current[j] = el;
                            }}
                            className='bk-face'
                            data-face={j}
                            data-cover={isCover ? "" : undefined}
                            data-spine={spine}
                            data-visible={visible ? "" : undefined}
                            aria-hidden={visible ? undefined : true}
                            inert={!visible}>
                            {isCover ? (
                                <>
                                    <div className='bk-cover'>{content}</div>
                                    {!open && !locked && rawPage !== null && (
                                        <button type='button' className='bk-cover-open' aria-label={t.book.open} onClick={() => goTo(initialPage)}/>
                                    )}
                                </>
                            ) : (
                                // .bk-sheet giữ nền giấy, lỗ đục và đường lề đứng yên; chỉ .bk-scroll (nội dung) cuộn
                                <div className='bk-sheet'>
                                    <div className='bk-scroll'><div className='bk-pad'>{content}</div></div>
                                    <i className='bk-fold bk-fold-r' aria-hidden='true'/>
                                    <i className='bk-fold bk-fold-l' aria-hidden='true'/>
                                </div>
                            )}
                            <i data-shade className='bk-shade' aria-hidden='true'/>
                        </div>
                    );
                })}

                <span aria-hidden='true' className='bk-rings'/>

                {tabButtons && <div className='bk-tabs' aria-label={t.book.tabs}>{tabButtons}</div>}

                {!locked && (
                    <>
                        <button type='button' className='bk-corner bk-corner-prev' aria-label={t.book.prev} disabled={!canPrev} onClick={() => step(-1)}/>
                        <button type='button' className='bk-corner bk-corner-next' aria-label={t.book.next} disabled={!canNext} onClick={() => step(1)}/>

                        <button
                            type='button'
                            className='bk-tag'
                            data-pulled={pulled ? "" : undefined}
                            aria-label={tagLabel}
                            title={tagLabel}
                            disabled={!open || page === 0}
                            onClick={pullTag}>
                            <span className='bk-tag-swing'>
                                {/* sợi dây xoắn đỏ buộc vào vòng gáy, luồn qua lỗ của thẻ */}
                                <svg className='bk-tag-cord' viewBox='0 0 60 34' aria-hidden='true'>
                                    <path d='M30 0 C 30 9, 35 13, 30 29' fill='none' stroke='#6e210d' strokeWidth='3' strokeLinecap='round'/>
                                    <path d='M30 0 C 30 9, 35 13, 30 29' fill='none' stroke='#d9603a' strokeWidth='1.6' strokeLinecap='round' strokeDasharray='2 2.4'/>
                                    <circle cx='30' cy='1.5' r='3' fill='#4a170a'/>
                                </svg>
                                <span className='bk-tag-body'>
                                    <i className='bk-tag-hole'/>
                                    {tagText}
                                </span>
                            </span>
                        </button>
                    </>
                )}
            </div>

            {tabButtons && <div className='bk-tabs-row' aria-label={t.book.tabs}>{tabButtons}</div>}

            {footer && <div className='bk-footer'>{footer}</div>}

            <p className='sr-only' aria-live='polite'>{open ? format(t.book.pageOf, {n: page + 1, total: count}) : t.book.closed}</p>
        </div>
    );
});
