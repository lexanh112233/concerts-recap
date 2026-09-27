import type {Metadata} from "next";
import {NotFoundView} from "@/components/views/not-found-view";
import {getDict} from "@/i18n/server";

export const metadata: Metadata = {title: getDict("en").notFound.metaTitle};

export default function NotFound() {
    return <NotFoundView lang="en"/>;
}
