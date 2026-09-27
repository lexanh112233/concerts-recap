import {localeTag, type Lang} from "@/i18n/config";

// Thông báo lỗi kiểm tra dữ liệu của trang quản trị. Không nằm trong từ điển giao diện vì các thư viện thuần (lib/event-input, costs,
// upload-rules, r2) tự dựng thông báo và chạy được cả ở server lẫn trình duyệt: bảng nhỏ này đi kèm chúng, còn chuỗi giao diện
// (i18n/admin/dictionaries) chỉ đến client qua provider.
export interface ValidationMessages {
    // tên hiển thị của các ô trong thông báo ("{label} không được để trống.")
    labels: {
        title: string
        artistName: string
        venue: string
        city: string
        zone: string
        row: string
        seat: string
        companion: string
        body: string
        extraCosts: string
        recoup: string
    }
    required: string
    tooLong: string
    bodyTooLong: string
    pickDate: string
    rating: string
    price: string
    maxImages: string
    badImage: string
    costs: {
        tooManyRows: string
        needsBoth: string
        labelTooLong: string
        amountInvalid: string
    }
    upload: {
        unsupported: string
        empty: string
        tooBig: string
        image: string
        video: string
    }
    form: {
        notFound: string
        database: string
    }
    r2: {
        notConfigured: string
        urlFailed: string
    }
}

const vi: ValidationMessages = {
    labels: {
        title: "Tên chương trình",
        artistName: "Nghệ sĩ",
        venue: "Địa điểm",
        city: "Thành phố",
        zone: "Zone",
        row: "Hàng",
        seat: "Ghế",
        companion: "Đi cùng",
        body: "Cảm nhận",
        extraCosts: "Chi phí phát sinh",
        recoup: "Khoản thu hồi",
    },
    required: "{label} không được để trống.",
    tooLong: "{label} tối đa {max} ký tự.",
    bodyTooLong: "Cảm nhận quá dài (tối đa 60.000 ký tự kể cả định dạng).",
    pickDate: "Chọn ngày diễn ra.",
    rating: "Đánh giá phải từ 0 đến 5.",
    price: "Giá vé phải là số từ 0 đến {max} (VND).",
    maxImages: "Tối đa {max} ảnh/video.",
    badImage: "Địa chỉ không hợp lệ: {url}. Chỉ nhận ảnh/video https từ {hosts}.",
    costs: {
        tooManyRows: "{label}: tối đa {max} dòng.",
        needsBoth: "{label} — dòng \"{row}\": cần cả nhãn và số tiền.",
        labelTooLong: "{label} — nhãn \"{row}\" tối đa {max} ký tự.",
        amountInvalid: "{label} — dòng \"{row}\": số tiền phải từ 0 đến {max} (VND).",
    },
    upload: {
        unsupported: "Định dạng không được hỗ trợ (jpg, png, webp, gif, avif, heic, mp4, webm, mov).",
        empty: "File rỗng.",
        tooBig: "{kind} quá lớn (tối đa {max}).",
        image: "Ảnh",
        video: "Video",
    },
    form: {
        notFound: "Không tìm thấy sự kiện để cập nhật.",
        database: "Không lưu được vào cơ sở dữ liệu. Kiểm tra lại dữ liệu rồi thử lại.",
    },
    r2: {
        notConfigured: "Chưa cấu hình Cloudflare R2 trong .env.",
        urlFailed: "Không tạo được đường dẫn tải lên.",
    },
};

const en: ValidationMessages = {
    labels: {
        title: "Show name",
        artistName: "Artist",
        venue: "Venue",
        city: "City",
        zone: "Zone",
        row: "Row",
        seat: "Seat",
        companion: "Went with",
        body: "How it felt",
        extraCosts: "Extra costs",
        recoup: "Money back",
    },
    required: "{label} can't be empty.",
    tooLong: "{label} can be at most {max} characters.",
    bodyTooLong: "The text is too long (at most 60,000 characters, formatting included).",
    pickDate: "Pick the show date.",
    rating: "Rating must be between 0 and 5.",
    price: "Ticket price must be a number from 0 to {max} (VND).",
    maxImages: "At most {max} photos/videos.",
    badImage: "Invalid address: {url}. Only https photos/videos from {hosts} are accepted.",
    costs: {
        tooManyRows: "{label}: at most {max} lines.",
        needsBoth: "{label} — line \"{row}\": needs both a label and an amount.",
        labelTooLong: "{label} — the label \"{row}\" can be at most {max} characters.",
        amountInvalid: "{label} — line \"{row}\": the amount must be from 0 to {max} (VND).",
    },
    upload: {
        unsupported: "Unsupported format (jpg, png, webp, gif, avif, heic, mp4, webm, mov).",
        empty: "The file is empty.",
        tooBig: "{kind} is too large (max {max}).",
        image: "Photo",
        video: "Video",
    },
    form: {
        notFound: "Couldn't find the event to update.",
        database: "Couldn't save to the database. Check the data and try again.",
    },
    r2: {
        notConfigured: "Cloudflare R2 isn't configured in .env.",
        urlFailed: "Couldn't create the upload link.",
    },
};

const TABLES: Record<Lang, ValidationMessages> = {vi, en};

export const validationMessages = (lang: Lang): ValidationMessages => TABLES[lang];

// "1.500.000" (vi) / "1,500,000" (en) cho các con số trong thông báo
export const groupedNumber = (n: number, lang: Lang) => n.toLocaleString(localeTag(lang));
