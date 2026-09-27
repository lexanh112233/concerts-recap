import {redirect} from "next/navigation";

// Trang đăng nhập riêng không còn: cuốn sổ khoá nằm ngay ở /admin. Giữ đường dẫn này cho các liên kết/dấu trang cũ.
export default function Page() {
    redirect("/admin");
}
