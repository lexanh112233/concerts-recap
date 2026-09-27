import "server-only";
import {en} from "@/i18n/dictionaries/en";
import type {Dict} from "@/i18n/dictionaries/types";
import {vi} from "@/i18n/dictionaries/vi";
import type {Lang} from "@/i18n/config";

// Từ điển cho server component. Chỉ import ở phía server: client component lấy chuỗi qua useI18n() (i18n/provider.tsx),
// nên bundle client không kéo theo cả hai từ điển.
const DICTS: Record<Lang, Dict> = {vi, en};

export const getDict = (lang: Lang): Dict => DICTS[lang];
