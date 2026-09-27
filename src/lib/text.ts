// Bỏ dấu và hạ chữ thường để tìm kiếm tiếng Việt không cần gõ dấu ("Phùng Khánh Linh" khớp "phung khanh linh").
// Hạ chữ thường TRƯỚC khi đổi đ → d: nếu làm ngược lại thì chữ Đ hoa ("ĐI VỀ NHÀ") không bao giờ thành d.
export function normalizeText(s: string) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d");
}
