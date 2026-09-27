"use client";

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent} from "react";
import {Check, NotebookPen, Settings} from "lucide-react";
import {LANGS, pathFor, switchPath, type Lang} from "@/i18n/config";
import {useI18n} from "@/i18n/provider";

// tên ngôn ngữ viết bằng chính ngôn ngữ đó (không dịch) để người đọc nhận ra dù đang ở ngôn ngữ nào
const NAME: Record<Lang, string> = {vi: "Tiếng Việt", en: "English"};
const ITEM = `flex w-full items-center justify-between gap-6 rounded-lg px-2.5 py-2 text-left text-sm text-paper/85 outline-hidden transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/10 focus-visible:text-white`;

// Một nút bánh răng gom mọi thiết lập của trang: chọn ngôn ngữ (VI | EN) và lối vào trang quản trị. Dùng chung cho header trang công khai
// và cho header trang quản trị nên hai nơi đổi ngôn ngữ y hệt nhau. Ngôn ngữ đi theo đường dẫn (tiền tố /en), nên mỗi lựa chọn là một
// liên kết tới đúng trang tương ứng chứ không phải trạng thái ẩn nào.
//  - variant "site": nút tròn trong suốt trên nền tối của header công khai
//  - variant "desk": nút giấy dán trên mặt bàn của trang quản trị (cùng họ với các chip "Về trang chủ", "Đăng xuất")
//  - admin: hiện thêm dòng dẫn tới trang quản trị (trang quản trị không cần dòng này vì đang ở trong đó)
export function SettingsMenu({variant = "site", admin = false, languages = true}: {
    variant?: "site" | "desk"
    admin?: boolean
    languages?: boolean
}) {
    const {lang, t} = useI18n();
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const menuId = useId();

    const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);

    // mở menu thì đưa con trỏ vào mục đang chọn (ngôn ngữ hiện tại) để dùng phím ↑ ↓ ngay
    useEffect(() => {
        if (!open) return;
        const list = items();
        (list.find((el) => el.getAttribute("aria-checked") === "true") ?? list[0])?.focus();
    }, [open]);

    // Dùng mousedown để bắt sự kiện click ra ngoài menu mà không hủy event của Safari
    useEffect(() => {
        if (!open) return;
        const onMouseDown = (e: globalThis.MouseEvent) => {
            if (!root.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [open]);

    const close = (returnFocus: boolean) => {
        setOpen(false);
        if (returnFocus) trigger.current?.focus();
    };

    const handleNavigate = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        setOpen(false);
        router.push(href);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape" && open) {
            e.preventDefault();
            close(true);
            return;
        }
        if (!open) {
            if (e.key === "ArrowDown" && e.target === trigger.current) {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        const list = items();
        const at = list.indexOf(document.activeElement as HTMLElement);
        const focus = (index: number) => list[(index + list.length) % list.length]?.focus();
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                focus(at + 1);
                break;
            case "ArrowUp":
                e.preventDefault();
                focus(at < 0 ? -1 : at - 1);
                break;
            case "Home":
                e.preventDefault();
                focus(0);
                break;
            case "End":
                e.preventDefault();
                focus(-1);
                break;
        }
    };

    const triggerClass = variant === "desk"
      ? `inline-flex size-9 items-center justify-center bg-ticket-stock text-ink shadow-[0_6px_10px_-5px_rgba(0,0,0,0.8),inset_0_-2px_0_rgba(0,0,0,0.08)] transition-[rotate] duration-200 [rotate:1.2deg] hover:[rotate:0deg] ${open ? "[rotate:0deg]" : ""}`
      : `inline-flex size-9 items-center justify-center rounded-full text-paper/80 transition-colors hover:bg-white/10 hover:text-white ${open ? "bg-white/10 text-white" : ""}`;

    return (
      <div
        ref={root}
        onKeyDown={onKeyDown}
        className='relative'>
          <button
            ref={trigger}
            type='button'
            aria-label={t.header.settings}
            title={t.header.settings}
            aria-haspopup='menu'
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            onClick={() => setOpen((o) => !o)}
            className={`${triggerClass} group cursor-pointer motion-reduce:transition-none`}>
              <Settings className={`size-[18px] transition-transform duration-500 ease-out motion-reduce:transition-none ${open ? "rotate-90" : "group-hover:rotate-45"}`}/>
          </button>

          {open && (
            <div
              ref={panel}
              id={menuId}
              role='menu'
              aria-label={t.header.settings}
              className='absolute right-0 top-full z-50 mt-2 w-56 origin-top-right animate-in fade-in-0 zoom-in-95 rounded-xl border border-white/12 bg-[#151311] p-1.5 text-paper shadow-[0_26px_44px_-14px_rgba(0,0,0,0.9)] duration-150 motion-reduce:animate-none'>
                {languages && (
                  <div role='group' aria-label={t.header.language}>
                      <p className='px-2.5 pb-1 pt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-paper/45'>{t.header.language}</p>
                      {LANGS.map((l) => {
                          const active = l === lang;
                          const href = switchPath(pathname, l);
                          return (
                            <Link
                              key={l}
                              href={href}
                              role='menuitemradio'
                              aria-checked={active}
                              lang={l}
                              hrefLang={l}
                              onClick={(e) => handleNavigate(e, href)}
                              className={`${ITEM} ${active ? "text-white" : ""}`}>
                                {NAME[l]}
                                {active
                                  ? <Check aria-hidden='true' className='size-4 text-accent'/>
                                  : <span aria-hidden='true' className='font-mono text-[10px] uppercase tracking-[0.16em] text-paper/35'>{l}</span>}
                            </Link>
                          );
                      })}
                  </div>
                )}

                {languages && admin && <div role='separator' className='mx-2 my-1.5 h-px bg-white/10'/>}

                {admin && (
                  <Link
                    href={pathFor(lang, "/admin")}
                    role='menuitem'
                    onClick={(e) => handleNavigate(e, pathFor(lang, "/admin"))}
                    className={`${ITEM}`}>
                      {t.header.admin}
                      <NotebookPen aria-hidden='true' className='size-4 text-paper/55'/>
                  </Link>
                )}
            </div>
          )}
      </div>
    );
}