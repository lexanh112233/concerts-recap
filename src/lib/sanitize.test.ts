import {describe, expect, it} from "vitest";
import {bodyToHtml, sanitizeBody} from "@/lib/sanitize";

// Lọc HTML nhật ký trước khi lưu và trước khi hiển thị (dangerouslySetInnerHTML ở trang chi tiết),
// nên đây là chỗ chặn XSS: mọi thứ ngoài danh sách cho phép phải biến mất.
describe("sanitizeBody: chặn XSS", () => {
    it("bỏ hẳn thẻ script cùng nội dung của nó", () => {
        expect(sanitizeBody("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
        expect(sanitizeBody("<ScRiPt>alert(1)</ScRiPt><p>ok</p>")).toBe("<p>ok</p>");
    });

    it("bỏ mọi thuộc tính sự kiện on*", () => {
        const out = sanitizeBody('<p onclick="alert(1)" onmouseover="x()">chữ</p>');
        expect(out).toBe("<p>chữ</p>");
    });

    it("bỏ ảnh, iframe, style, form và các thẻ ngoài danh sách", () => {
        expect(sanitizeBody('<img src="x" onerror="alert(1)"><p>a</p>')).toBe("<p>a</p>");
        expect(sanitizeBody('<iframe src="https://evil.example"></iframe><p>a</p>')).toBe("<p>a</p>");
        expect(sanitizeBody("<style>body{display:none}</style><p>a</p>")).toBe("<p>a</p>");
        expect(sanitizeBody('<form action="https://evil.example"><input name="x"></form><p>a</p>')).not.toMatch(/<form|<input/);
        expect(sanitizeBody("<div><p>a</p></div>")).toBe("<p>a</p>");
    });

    it.each([
        ["javascript:alert(1)"],
        ["  javascript:alert(1)"],
        ["JaVaScRiPt:alert(1)"],
        ["java&#x09;script:alert(1)"],
        ["data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
        ["vbscript:msgbox(1)"],
        ["//evil.example/x"],
    ])("bỏ href nguy hiểm %j", (href) => {
        const out = sanitizeBody(`<p><a href="${href}">bấm</a></p>`);
        expect(out).not.toMatch(/href=/i);
        expect(out).not.toMatch(/javascript|vbscript|data:|evil\.example/i);
        expect(out).toContain("bấm");
    });

    it("giữ nguyên các liên kết http, https, mailto", () => {
        expect(sanitizeBody('<p><a href="https://example.com/a?b=1">a</a></p>')).toContain('href="https://example.com/a?b=1"');
        expect(sanitizeBody('<p><a href="http://example.com">a</a></p>')).toContain('href="http://example.com"');
        expect(sanitizeBody('<p><a href="mailto:a@example.com">a</a></p>')).toContain('href="mailto:a@example.com"');
    });

    it("mọi liên kết đều mở tab mới và không lộ trang gốc", () => {
        const out = sanitizeBody('<p><a href="https://example.com" target="_self" rel="opener">a</a></p>');
        expect(out).toMatch(/rel="noopener noreferrer nofollow"/);
        expect(out).toMatch(/target="_blank"/);
        expect(out).not.toMatch(/target="_self"|rel="opener"/);
    });

    it("chữ trông giống thẻ nhưng đã escape thì vẫn chỉ là chữ", () => {
        expect(sanitizeBody("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    });
});

describe("sanitizeBody: style", () => {
    it("chỉ cho phép text-align left/center/right", () => {
        expect(sanitizeBody('<p style="text-align:center">a</p>')).toBe('<p style="text-align:center">a</p>');
        expect(sanitizeBody('<h2 style="text-align:right">a</h2>')).toBe('<h2 style="text-align:right">a</h2>');
    });

    it("bỏ giá trị text-align lạ và mọi thuộc tính CSS khác", () => {
        expect(sanitizeBody('<p style="text-align:justify">a</p>')).toBe("<p>a</p>");
        expect(sanitizeBody('<p style="position:fixed;top:0;background:url(https://evil.example/x)">a</p>')).toBe("<p>a</p>");
        expect(sanitizeBody('<p style="text-align:center;color:red">a</p>')).toBe('<p style="text-align:center">a</p>');
    });

    it("style chỉ được giữ trên đoạn văn và tiêu đề", () => {
        expect(sanitizeBody('<blockquote style="text-align:center">a</blockquote>')).toBe("<blockquote>a</blockquote>");
    });
});

describe("sanitizeBody: giữ định dạng của trình soạn thảo", () => {
    it("giữ nguyên các thẻ được phép (thẻ đơn br/hr được ghi lại dạng tự đóng)", () => {
        const html = "<h2>a</h2><h3>b</h3><p><strong>c</strong> <em>d</em> <u>e</u> <s>f</s><br></p>"
            + "<ul><li><p>g</p></li></ul><ol><li><p>h</p></li></ol><blockquote><p>i</p></blockquote><hr>";
        expect(sanitizeBody(html)).toBe(html.replace("<br>", "<br />").replace("<hr>", "<hr />"));
    });

    it("đổi thẻ dán từ Word/web sang thẻ tương đương", () => {
        expect(sanitizeBody("<p><b>a</b> <i>b</i> <strike>c</strike> <del>d</del></p>")).toBe(
            "<p><strong>a</strong> <em>b</em> <s>c</s> <s>d</s></p>",
        );
        expect(sanitizeBody("<h1>a</h1><h4>b</h4><h5>c</h5><h6>d</h6>")).toBe("<h2>a</h2><h3>b</h3><h3>c</h3><h3>d</h3>");
    });

    it("giữ chữ tiếng Việt có dấu", () => {
        expect(sanitizeBody("<p>Đêm nhạc “Ánh Sáng” & Màn Đêm</p>")).toBe("<p>Đêm nhạc “Ánh Sáng” &amp; Màn Đêm</p>");
    });
});

describe("bodyToHtml", () => {
    it("nhật ký HTML được lọc như sanitizeBody", () => {
        expect(bodyToHtml("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
    });

    it("nhật ký cũ dạng văn bản được đổi sang đoạn văn và danh sách", () => {
        expect(bodyToHtml("Mở đầu\n- một\n- hai")).toBe("<p>Mở đầu</p><ul><li><p>một</p></li><li><p>hai</p></li></ul>");
    });

    it("văn bản cũ chứa thẻ HTML thì chỉ hiện ra như chữ, không chạy", () => {
        const out = bodyToHtml("<script>alert(1)</script>");
        expect(out).not.toMatch(/<script/i);
        expect(out).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
        expect(bodyToHtml("<img src=x onerror=alert(1)>")).not.toMatch(/<img/i);
    });
});
