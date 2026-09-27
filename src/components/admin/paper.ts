// Class dùng chung cho các ô nhập trên trang giấy của sổ quản trị (nền giấy kem, mực đen).
// Ô nhập là "dòng kẻ để điền chữ": chỉ có đường gạch chân, gõ vào thì đường đổi sang màu thương hiệu.
export const INPUT =
    "h-10 w-full border-0 border-b border-ink/40 bg-transparent px-1 font-playpen-sans text-[15px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-accent focus:bg-accent/[0.06] aria-[invalid=true]:border-[#a3241a] data-[invalid=true]:border-[#a3241a]";

export const LABEL = "font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink/60";

export const HINT = "font-playpen-sans text-xs leading-snug text-ink/55";

// mực đỏ đậm (không dùng --destructive: quá nhạt trên giấy kem)
export const ERROR = "font-playpen-sans text-xs font-semibold leading-snug text-[#a3241a]";

export const FOCUS =
    "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// nút nhỏ trên giấy (xoá dòng, đổi thứ tự...)
export const GHOST_BUTTON = `flex shrink-0 cursor-pointer items-center justify-center rounded-md text-ink/60 transition-colors hover:bg-ink/10 hover:text-ink ${FOCUS}`;
