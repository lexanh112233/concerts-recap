// Tên hiển thị của trang ("Linh đi show"): phần tên của chủ trang lấy từ biến môi trường NEXT_PUBLIC_YOUR_NAME để ai dùng lại bộ mã này
// chỉ cần đổi biến, không sửa code. "đi show" là tên gọi cố định của trang nên không đổi. Module thuần, dùng được ở cả server lẫn client.
//
// Biến NEXT_PUBLIC_ được nhúng vào bundle LÚC BUILD (không phải lúc chạy): đổi giá trị thì phải build/deploy lại. Trên Vercel cần đặt biến
// ở Project Settings → Environment Variables rồi redeploy. Chưa đặt thì dùng tên mặc định bên dưới ("Mình đi show").
export const DEFAULT_OWNER_NAME = "Mình";
export const BRAND_SUFFIX = "đi show";

// Bỏ khoảng trắng thừa ở đầu, cuối và giữa tên; để trống hoặc chưa đặt thì dùng tên mặc định.
export function resolveOwnerName(raw: string | undefined): string {
    const name = (raw ?? "").replace(/\s+/g, " ").trim();
    return name || DEFAULT_OWNER_NAME;
}

// Phải viết nguyên dạng process.env.NEXT_PUBLIC_YOUR_NAME (không truy cập động) thì Next mới thay giá trị vào lúc build
export const OWNER_NAME = resolveOwnerName(process.env.NEXT_PUBLIC_YOUR_NAME);

// "Mình đi show" (hoặc "<tên bạn> đi show"): tên trang dùng cho tiêu đề tab, metadata, chia sẻ mạng xã hội
export const BRAND_NAME = `${OWNER_NAME} ${BRAND_SUFFIX}`;
