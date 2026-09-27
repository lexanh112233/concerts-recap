"use client";

import {useState, type ReactNode} from "react";
import {EditorContent, useEditor, useEditorState} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {Placeholder} from "@tiptap/extensions";
import {
    Bold,
    Check,
    Eraser,
    Heading2,
    Heading3,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Pilcrow,
    Quote,
    Redo2,
    Strikethrough,
    TextAlignCenter,
    TextAlignEnd,
    TextAlignStart,
    Underline,
    Undo2,
    Unlink,
    X,
    type LucideIcon,
} from "lucide-react";
import {ERROR, FOCUS, HINT, INPUT, LABEL} from "@/components/admin/paper";
import {useAdminI18n} from "@/i18n/admin/provider";

function Tool({label, shortcut, icon: Icon, active, disabled, onClick}: {
    label: string
    shortcut?: string
    icon: LucideIcon
    active?: boolean
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button
            type='button'
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            // giữ nguyên vùng bôi đen của trình soạn thảo khi bấm nút
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={`flex size-9 shrink-0 items-center justify-center rounded-md transition-colors md:size-8 disabled:pointer-events-none disabled:opacity-30 ${active ? "bg-accent text-paper" : "text-ink/75 hover:bg-ink/10 hover:text-ink"} ${FOCUS}`}>
            <Icon className='size-4'/>
        </button>
    );
}

// mỗi nhóm nút xuống dòng nguyên khối nên thanh công cụ hẹp không bị tách lẻ một nút
const Group = ({children}: { children: ReactNode }) => <div className='flex items-center gap-0.5'>{children}</div>;

// Tự thêm https:// nếu người dùng chỉ gõ tên miền
function normalizeUrl(value: string) {
    const v = value.trim();
    if (!v) return "";
    if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? `mailto:${v}` : `https://${v}`;
}

export function RichTextEditor({name, label, defaultValue, error, hint}: {
    name: string
    label: string
    // HTML ban đầu
    defaultValue: string
    error?: string
    hint?: ReactNode
}) {
    const {t} = useAdminI18n();
    const [html, setHtml] = useState(defaultValue);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkValue, setLinkValue] = useState("");

    const editor = useEditor({
        // tránh lệch HTML giữa server và client khi render lần đầu
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: {levels: [2, 3]},
                code: false,
                codeBlock: false,
                link: {openOnClick: false, autolink: true, defaultProtocol: "https"},
            }),
            TextAlign.configure({types: ["heading", "paragraph"]}),
            Placeholder.configure({placeholder: t.editor.placeholder}),
        ],
        content: defaultValue,
        editorProps: {
            attributes: {
                id: `${name}-editor`,
                // Playpen Sans chỉ cho ô soạn thảo; trang nhật ký công khai vẫn dùng Playfair (xem --rich-font ở globals.css)
                class: "rich rich-ink min-h-64 px-4 py-3 text-base outline-none [--rich-font:var(--font-playpen-sans)] md:text-lg",
                role: "textbox",
                "aria-multiline": "true",
                "aria-labelledby": `${name}-label`,
            },
        },
        onUpdate: ({editor}) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
    });

    // v3 không tự vẽ lại thanh công cụ khi con trỏ đổi chỗ, nên phải đọc trạng thái qua useEditorState
    const s = useEditorState({
        editor,
        selector: ({editor}) => editor ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            underline: editor.isActive("underline"),
            strike: editor.isActive("strike"),
            h2: editor.isActive("heading", {level: 2}),
            h3: editor.isActive("heading", {level: 3}),
            paragraph: editor.isActive("paragraph"),
            bullet: editor.isActive("bulletList"),
            ordered: editor.isActive("orderedList"),
            quote: editor.isActive("blockquote"),
            link: editor.isActive("link"),
            center: editor.isActive({textAlign: "center"}),
            right: editor.isActive({textAlign: "right"}),
            canUndo: editor.can().undo(),
            canRedo: editor.can().redo(),
        } : null,
    });

    const openLink = () => {
        if (!editor) return;
        setLinkValue(editor.getAttributes("link").href ?? "");
        setLinkOpen(true);
    };

    const applyLink = () => {
        if (!editor) return;
        const href = normalizeUrl(linkValue);
        const chain = editor.chain().focus().extendMarkRange("link");
        if (href) chain.setLink({href}).run();
        else chain.unsetLink().run();
        setLinkOpen(false);
    };

    const removeLink = () => {
        editor?.chain().focus().extendMarkRange("link").unsetLink().run();
        setLinkOpen(false);
    };

    const run = editor ? editor.chain().focus() : null;
    const left = !!s && !s.center && !s.right;

    return (
        <div className='flex flex-col gap-1.5'>
            <p id={`${name}-label`} className={LABEL}>{label}</p>
            <input type='hidden' name={name} value={html}/>

            <div className={`border bg-white/45 shadow-[inset_0_1px_3px_rgba(60,40,15,0.12)] transition-colors focus-within:border-accent ${error ? "border-[#a3241a]" : "border-ink/25"}`}>
                <div
                    role='toolbar'
                    aria-label={t.editor.toolbar}
                    aria-controls={`${name}-editor`}
                    className='sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/15 bg-[#e9dfc8] p-1.5 shadow-[0_6px_8px_-7px_rgba(38,30,20,0.45)]'>
                    <Group>
                        <Tool label={t.editor.undo} shortcut='Ctrl+Z' icon={Undo2} disabled={!s?.canUndo} onClick={() => run?.undo().run()}/>
                        <Tool label={t.editor.redo} shortcut='Ctrl+Shift+Z' icon={Redo2} disabled={!s?.canRedo} onClick={() => run?.redo().run()}/>
                    </Group>
                    <Group>
                        <Tool label={t.editor.paragraph} icon={Pilcrow} active={!!s?.paragraph && !s.bullet && !s.ordered && !s.quote} onClick={() => run?.setParagraph().run()}/>
                        <Tool label={t.editor.heading2} icon={Heading2} active={s?.h2} onClick={() => run?.toggleHeading({level: 2}).run()}/>
                        <Tool label={t.editor.heading3} icon={Heading3} active={s?.h3} onClick={() => run?.toggleHeading({level: 3}).run()}/>
                    </Group>
                    <Group>
                        <Tool label={t.editor.bold} shortcut='Ctrl+B' icon={Bold} active={s?.bold} onClick={() => run?.toggleBold().run()}/>
                        <Tool label={t.editor.italic} shortcut='Ctrl+I' icon={Italic} active={s?.italic} onClick={() => run?.toggleItalic().run()}/>
                        <Tool label={t.editor.underline} shortcut='Ctrl+U' icon={Underline} active={s?.underline} onClick={() => run?.toggleUnderline().run()}/>
                        <Tool label={t.editor.strike} shortcut='Ctrl+Shift+S' icon={Strikethrough} active={s?.strike} onClick={() => run?.toggleStrike().run()}/>
                    </Group>
                    <Group>
                        <Tool label={t.editor.bullets} shortcut='Ctrl+Shift+8' icon={List} active={s?.bullet} onClick={() => run?.toggleBulletList().run()}/>
                        <Tool label={t.editor.numbers} shortcut='Ctrl+Shift+7' icon={ListOrdered} active={s?.ordered} onClick={() => run?.toggleOrderedList().run()}/>
                        <Tool label={t.editor.quote} shortcut='Ctrl+Shift+B' icon={Quote} active={s?.quote} onClick={() => run?.toggleBlockquote().run()}/>
                    </Group>
                    <Group>
                        <Tool label={t.editor.alignLeft} icon={TextAlignStart} active={left} onClick={() => run?.setTextAlign("left").run()}/>
                        <Tool label={t.editor.alignCenter} icon={TextAlignCenter} active={s?.center} onClick={() => run?.setTextAlign("center").run()}/>
                        <Tool label={t.editor.alignRight} icon={TextAlignEnd} active={s?.right} onClick={() => run?.setTextAlign("right").run()}/>
                    </Group>
                    <Group>
                        <Tool label={t.editor.link} icon={LinkIcon} active={s?.link} onClick={openLink}/>
                        {s?.link && <Tool label={t.editor.unlink} icon={Unlink} onClick={removeLink}/>}
                        <Tool label={t.editor.clear} icon={Eraser} onClick={() => run?.unsetAllMarks().clearNodes().run()}/>
                    </Group>
                </div>

                {linkOpen && (
                    <div className='flex items-center gap-2 border-b border-ink/15 bg-[#f1e9d5] p-2'>
                        <input
                            type='text'
                            autoFocus
                            value={linkValue}
                            onChange={(e) => setLinkValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    applyLink();
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setLinkOpen(false);
                                    editor?.chain().focus().run();
                                }
                            }}
                            placeholder={t.editor.linkPlaceholder}
                            aria-label={t.editor.linkAria}
                            className={`${INPUT} min-w-0 flex-1`}
                        />
                        <button type='button' onClick={applyLink} aria-label={t.editor.linkApply}
                                className='flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-paper transition-opacity hover:opacity-90'>
                            <Check className='size-4'/>
                        </button>
                        <button type='button' onClick={() => setLinkOpen(false)} aria-label={t.editor.close}
                                className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink/65 transition-colors hover:bg-ink/10 hover:text-ink ${FOCUS}`}>
                            <X className='size-4'/>
                        </button>
                    </div>
                )}

                <EditorContent editor={editor}/>
            </div>

            {error ? (
                <p className={ERROR} role='alert'>{error}</p>
            ) : hint ? (
                <p className={HINT}>{hint}</p>
            ) : null}
        </div>
    );
}
