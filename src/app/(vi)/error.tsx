"use client";

import {ErrorView} from "@/components/views/error-view";

export default function ErrorPage(props: { error: Error & { digest?: string }, retry: () => void }) {
    return <ErrorView {...props}/>;
}
