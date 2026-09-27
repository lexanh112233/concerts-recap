import {describe, expect, it} from "vitest";
import {bodyToText, htmlToText, isRichBody, plainToHtml} from "@/lib/rich-text";

describe("isRichBody", () => {
    it.each([
        "<p>Xin chào</p>",
        "  \n<h2>Tiêu đề</h2>",
        "<ul><li>a</li></ul>",
        "<ol><li>a</li></ol>",
        "<blockquote>trích</blockquote>",
        "<hr>",
        "<P>viết hoa thẻ</P>",
        '<p style="text-align:center">căn giữa</p>',
    ])("nhận %j là HTML của trình soạn thảo", (body) => {
        expect(isRichBody(body)).toBe(true);
    });

    it.each([
        "Xin chào",
        "- gạch đầu dòng",
        "1 < 2",
        "<div>không phải thẻ khối của trình soạn thảo</div>",
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        "<paragraph>gần giống</paragraph>",
        "",
    ])("coi %j là văn bản thường (sẽ bị escape, không bao giờ chạy như HTML)", (body) => {
        expect(isRichBody(body)).toBe(false);
    });
});

describe("plainToHtml", () => {
    it("mỗi dòng một đoạn văn, bỏ dòng trống, chịu được CRLF", () => {
        expect(plainToHtml("Dòng một\r\n\r\nDòng hai\n")).toBe("<p>Dòng một</p><p>Dòng hai</p>");
    });

    it("dòng bắt đầu bằng - hoặc • là gạch đầu dòng, các dòng liền nhau gộp một danh sách", () => {
        expect(plainToHtml("- một\n• hai")).toBe("<ul><li><p>một</p></li><li><p>hai</p></li></ul>");
    });

    it("đóng danh sách khi gặp đoạn văn thường và mở lại khi có gạch đầu dòng tiếp", () => {
        expect(plainToHtml("Mở đầu\n- a\nGiữa\n- b")).toBe(
            "<p>Mở đầu</p><ul><li><p>a</p></li></ul><p>Giữa</p><ul><li><p>b</p></li></ul>",
        );
    });

    it("gạch nối không kèm khoảng trắng không phải gạch đầu dòng", () => {
        expect(plainToHtml("-không phải bullet")).toBe("<p>-không phải bullet</p>");
    });

    it("escape ký tự HTML để văn bản cũ không thể chèn thẻ", () => {
        expect(plainToHtml("1 < 2 & 3 > 2 <b>x</b>")).toBe("<p>1 &lt; 2 &amp; 3 &gt; 2 &lt;b&gt;x&lt;/b&gt;</p>");
    });

    it("chuỗi rỗng cho ra chuỗi rỗng", () => {
        expect(plainToHtml("")).toBe("");
        expect(plainToHtml("  \n \n")).toBe("");
    });
});

describe("htmlToText", () => {
    it("mỗi khối là một dòng", () => {
        expect(htmlToText("<p>Một</p><p>Hai</p>")).toBe("Một\nHai");
        expect(htmlToText("<h2>Tiêu đề</h2><p>Nội dung</p>")).toBe("Tiêu đề\nNội dung");
        expect(htmlToText("<ul><li>a</li><li>b</li></ul>")).toBe("a\nb");
    });

    it("<br> xuống dòng, thẻ định dạng chỉ bị bỏ", () => {
        expect(htmlToText("<p>a<br>b <strong>đậm</strong> <em>nghiêng</em></p>")).toBe("a\nb đậm nghiêng");
    });

    it("giải mã các entity thường gặp", () => {
        expect(htmlToText("<p>A &amp; B &lt;c&gt; &quot;d&quot; &#39;e&#39;&nbsp;f</p>")).toBe(`A & B <c> "d" 'e' f`);
    });

    it("gom nhiều dòng trống và cắt khoảng trắng hai đầu", () => {
        expect(htmlToText("<p>a</p><p></p><p></p><p></p><p>b</p>")).toBe("a\n\nb");
        expect(htmlToText("  <p>a</p>  ")).toBe("a");
    });

    it("HTML rỗng (trình soạn thảo chưa gõ gì) cho ra chuỗi rỗng", () => {
        expect(htmlToText("<p></p>")).toBe("");
    });
});

describe("bodyToText", () => {
    it("nhật ký HTML thì bóc thẻ, nhật ký cũ dạng văn bản thì giữ nguyên và cắt khoảng trắng", () => {
        expect(bodyToText("<p>Xin chào</p>")).toBe("Xin chào");
        expect(bodyToText("  Văn bản cũ\n- gạch  ")).toBe("Văn bản cũ\n- gạch");
    });
});
