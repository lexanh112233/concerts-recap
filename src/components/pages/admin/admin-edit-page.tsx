import {notFound} from "next/navigation";
import {EventForm} from "@/components/admin/event-form";
import type {Lang} from "@/i18n/config";
import {requireAdmin} from "@/lib/admin-auth";
import type {IConcert} from "@/lib/concerts";
import {netActualCost, netActualCostLabel} from "@/lib/costs";
import connectToDatabase from "@/lib/db";
import {valuesFromDoc} from "@/lib/event-input";
import {isR2Configured} from "@/lib/r2";
import diaryEntries from "@/models/diaries";

export async function AdminEditPage({lang, slug}: { lang: Lang, slug: string }) {
    await requireAdmin(lang);

    await connectToDatabase();
    // không lọc active để sửa được cả sự kiện đang ẩn khỏi trang công khai
    const doc = (await diaryEntries.findOne({slug}).lean()) as unknown as IConcert | null;
    if (!doc) notFound();

    // số của lần lưu gần nhất (chưa phản ánh chỗ đang sửa dở trong form); null khi chưa có giá vé
    const net = netActualCostLabel(netActualCost(doc.ticketPrice, doc.extraCosts, doc.merchResale), lang);

    return (
        <EventForm
            initial={valuesFromDoc(doc)}
            originalSlug={doc.slug}
            r2Enabled={isR2Configured()}
            savedNet={net}
        />
    );
}
