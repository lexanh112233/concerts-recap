import {EventForm} from "@/components/admin/event-form";
import type {Lang} from "@/i18n/config";
import {requireAdmin} from "@/lib/admin-auth";
import {EMPTY_VALUES} from "@/lib/event-input";
import {isR2Configured} from "@/lib/r2";

export async function AdminNewPage({lang}: { lang: Lang }) {
    await requireAdmin(lang);

    return <EventForm initial={EMPTY_VALUES} r2Enabled={isR2Configured()}/>;
}
