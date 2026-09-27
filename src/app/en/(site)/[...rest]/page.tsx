import {notFound} from "next/navigation";

// Mọi đường dẫn công khai không khớp route nào rơi vào đây và trả 404 ngay trong root layout của ngôn ngữ này
// (có header/footer và đúng font), thay vì layout trần của Next. force-dynamic để không cache từng URL lạ.
export const dynamic = "force-dynamic";

export default function CatchAll(): never {
    notFound();
}
