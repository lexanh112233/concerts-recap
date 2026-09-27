import mongoose, { Schema, model, models } from "mongoose";

// Một dòng chi phí/thu nhập tự do (nhãn tự đặt + số tiền VND) — xem src/lib/costs.ts.
const CostItemSchema = new Schema(
    {
        label: { type: String, required: true, trim: true, maxlength: 80 },
        amount: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const DiariesSchema = new Schema(
    {
        slug: { type: String, required: true, unique: true, index: true },
        kind: { type: String, required: true },
        date: { type: Date, required: true },
        title: { type: String, required: true },
        body: { type: String, required: true },
        images: { type: [String], default: [] },
        city: { type: String, default: null },
        venue: { type: String, default: null },
        artistName: { type: String, required: true },
        concertVenue: { type: String, required: true },
        zone: { type: String, default: null },
        row: { type: String, default: null },
        seat: { type: String, default: null },
        companion: { type: String, required: true },
        // VND, số nguyên. null: chưa biết giá; 0: vé mời/miễn phí
        ticketPrice: { type: Number, default: null, min: 0 },
        // Chi phí phát sinh ngoài giá vé: vận chuyển, taxi, Grab, công camp vé, membership... (chỉ dùng ở trang quản trị, không ra trang công khai)
        extraCosts: { type: [CostItemSchema], default: [] },
        // Tiền thu lại khi bán merch tặng kèm vé (bán lẻ từng món hoặc bán full set) để giảm chi thực tế (chỉ dùng ở trang quản trị)
        merchResale: { type: [CostItemSchema], default: [] },
        rating: { type: Number, required: true, min: 0, max: 5, default: 0 },
        // CHỈ là hiển thị: có hiện ra trang công khai hay không (false = đang ẩn). "Sắp diễn ra" không lưu ở đây, suy ra từ `date` (lib/concerts.ts isUpcoming)
        active: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

// Tránh khởi tạo lại model nếu đã tồn tại trong models cache
const diaryEntries = models.diaryEntries || model("diaryEntries", DiariesSchema, "diaryEntries");
export default diaryEntries;