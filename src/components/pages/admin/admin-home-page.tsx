import {AdminBook} from "@/components/admin/admin-book";
import type {Lang} from "@/i18n/config";
import connectToDatabase from "@/lib/db";
import diaryEntries from "@/models/diaries";
import {isAdmin, isAdminConfigured} from "@/lib/admin-auth";
import {toAdminRow} from "@/lib/admin-list";
import type {IConcert} from "@/lib/concerts";
import {isR2Configured} from "@/lib/r2";

type Param = string | string[] | undefined;
const first = (value: Param) => (typeof value === "string" ? value : undefined);

// Trang /admin và /en/admin: cuốn sổ danh sách. Tham số trên URL (đều là kết quả của một server action vừa chạy xong):
// `saved`: slug đêm vừa lưu (sổ mở tới đúng trang chứa nó); `deleted`: mốc thời gian lần xoá vừa xong (hiện giấy nhớ "đã xoá");
// `leftover`: số file R2 của đêm vừa xoá mà chưa xoá được.
//
// Chưa đăng nhập thì cũng là chính cuốn sổ này nhưng còn KHOÁ (bìa đóng, mật khẩu điền trên nhãn bìa) và chưa có dữ liệu nào. Nhập đúng mật khẩu thì server action
// ghi cookie phiên, Next dựng lại trang này ngay trong phản hồi của action, lần này trả danh sách thật: cùng một AdminBook nhận props mới và bìa mở ra tại chỗ
// với nội dung đã nằm sẵn dưới bìa. Không có chuyển trang nào (đó là lý do không tách một trang /admin/login riêng: mỗi lần chuyển trang là một chặng chờ).
export async function AdminHomePage({lang, saved: savedParam, deleted: deletedParam, leftover: leftoverParam}: {
    lang: Lang
    saved?: Param
    deleted?: Param
    leftover?: Param
}) {
    const saved = first(savedParam);
    const deleted = first(deletedParam);
    // số nguyên dương hợp lý (giá trị lạ trên URL thì coi như không có)
    const leftover = Math.min(Math.max(Math.floor(Number(first(leftoverParam))) || 0, 0), 999);
    if (!(await isAdmin())) {
        return <AdminBook locked configured={isAdminConfigured()} rows={[]} r2={false}/>;
    }

    await connectToDatabase();
    // gồm cả sự kiện đang ẩn khỏi trang công khai; việc lọc, sắp xếp, chia trang làm ở client (sổ cần tất cả các dòng)
    const docs = (await diaryEntries.find({}).lean()) as unknown as IConcert[];

    return <AdminBook rows={docs.map((doc) => toAdminRow(doc, lang))} saved={saved} deleted={deleted} leftover={leftover} r2={isR2Configured()}/>;
}
