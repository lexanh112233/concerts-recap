import {describe, expect, it} from "vitest";
import {
    HEIC_TYPES,
    looksLikeHeic,
    MAX_BYTES,
    MAX_LABEL,
    UPLOAD_ACCEPT,
    UPLOAD_TYPES,
    validateHeic,
    validateUpload,
} from "@/lib/upload-rules";

const MB = 1024 * 1024;

describe("validateUpload", () => {
    it.each(Object.keys(UPLOAD_TYPES))("nhận %s ở dung lượng bình thường", (type) => {
        expect(validateUpload(type, 1024)).toBeNull();
    });

    it("từ chối định dạng lạ, kể cả HEIC (HEIC phải được đổi sang JPEG trước khi tải lên)", () => {
        expect(validateUpload("application/pdf", 1024)).toContain("Định dạng không được hỗ trợ");
        expect(validateUpload("image/svg+xml", 1024)).toContain("Định dạng không được hỗ trợ");
        expect(validateUpload("image/heic", 1024)).toContain("Định dạng không được hỗ trợ");
        expect(validateUpload("", 1024)).toContain("Định dạng không được hỗ trợ");
    });

    it("từ chối file rỗng hoặc dung lượng âm", () => {
        expect(validateUpload("image/jpeg", 0)).toBe("File rỗng.");
        expect(validateUpload("image/jpeg", -1)).toBe("File rỗng.");
    });

    it("ảnh tối đa 25MB, đúng ở biên thì nhận, quá 1 byte thì từ chối", () => {
        expect(MAX_BYTES.image).toBe(25 * MB);
        expect(validateUpload("image/png", 25 * MB)).toBeNull();
        expect(validateUpload("image/png", 25 * MB + 1)).toBe("Ảnh quá lớn (tối đa 25MB).");
    });

    it("video tối đa 60MB, giới hạn của ảnh không áp cho video", () => {
        expect(MAX_BYTES.video).toBe(60 * MB);
        expect(validateUpload("video/mp4", 30 * MB)).toBeNull();
        expect(validateUpload("video/mp4", 60 * MB)).toBeNull();
        expect(validateUpload("video/mp4", 60 * MB + 1)).toBe("Video quá lớn (tối đa 60MB).");
    });

    it("đuôi file lưu lên R2 khớp với loại file", () => {
        expect(UPLOAD_TYPES["image/jpeg"].ext).toBe("jpg");
        expect(UPLOAD_TYPES["video/quicktime"].ext).toBe("mov");
        expect(UPLOAD_TYPES["video/quicktime"].kind).toBe("video");
    });
});

describe("validateHeic", () => {
    it("chỉ kiểm tra dung lượng theo giới hạn của ảnh", () => {
        expect(validateHeic(1024)).toBeNull();
        expect(validateHeic(25 * MB)).toBeNull();
        expect(validateHeic(25 * MB + 1)).toBe("Ảnh quá lớn (tối đa 25MB).");
        expect(validateHeic(0)).toBe("File rỗng.");
    });
});

describe("looksLikeHeic", () => {
    it.each(HEIC_TYPES)("nhận ra theo MIME %s (không phân biệt hoa thường)", (type) => {
        expect(looksLikeHeic("anh", type)).toBe(true);
        expect(looksLikeHeic("anh", type.toUpperCase())).toBe(true);
    });

    it.each(["IMG_0001.HEIC", "a.heif", "b.hif"])("nhận ra theo đuôi %s khi trình duyệt để MIME rỗng", (name) => {
        expect(looksLikeHeic(name, "")).toBe(true);
    });

    it("không nhầm với ảnh thường", () => {
        expect(looksLikeHeic("photo.jpg", "image/jpeg")).toBe(false);
        expect(looksLikeHeic("heic.jpg", "")).toBe(false);
        expect(looksLikeHeic("anh.heic.png", "image/png")).toBe(false);
    });
});

describe("hằng số hiển thị", () => {
    it("nhãn dung lượng tính từ giới hạn thật", () => {
        expect(MAX_LABEL).toEqual({image: "25MB", video: "60MB"});
    });

    it("hộp chọn file cho phép cả HEIC (MIME lẫn đuôi)", () => {
        const accept = UPLOAD_ACCEPT.split(",");
        expect(accept).toEqual(expect.arrayContaining(["image/jpeg", "video/mp4", "image/heic", "image/heif", ".heic", ".heif"]));
    });
});

describe("thông báo tiếng Anh", () => {
    it("validateUpload", () => {
        expect(validateUpload("application/pdf", 1024, "en")).toContain("Unsupported format");
        expect(validateUpload("image/jpeg", 0, "en")).toBe("The file is empty.");
        expect(validateUpload("image/png", 25 * MB + 1, "en")).toBe("Photo is too large (max 25MB).");
        expect(validateUpload("video/mp4", 60 * MB + 1, "en")).toBe("Video is too large (max 60MB).");
        expect(validateUpload("image/png", 1024, "en")).toBeNull();
    });

    it("validateHeic", () => {
        expect(validateHeic(0, "en")).toBe("The file is empty.");
        expect(validateHeic(25 * MB + 1, "en")).toBe("Photo is too large (max 25MB).");
        expect(validateHeic(1024, "en")).toBeNull();
    });
});
