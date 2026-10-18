"use client";

import { Download, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/Providers";
import { downloadMeme } from "@/lib/download";
import type { MemeFormat } from "@/lib/styles";

// Download / copy link / share for one meme. "Link" points at the meme's public page.
export default function ShareControls({
    captionId,
    url,
    caption,
    format,
    showLink = true,
}: {
    captionId: string;
    url: string;
    caption: string;
    format: MemeFormat;
    // Drafts have no public page yet, so they only get Download.
    showLink?: boolean;
}) {
    const { toast } = useApp();
    const [busy, setBusy] = useState(false);

    function link() {
        return `${window.location.origin}/m/${captionId}`;
    }

    async function onDownload() {
        setBusy(true);
        try {
            await downloadMeme(url, caption, format, `laugh-or-laugh-${captionId.slice(0, 8)}.png`);
            toast("Meme exported. The internet has been notified.");
        } catch {
            toast("Export failed. The meme resisted. Try again.");
        }
        setBusy(false);
    }

    async function onCopy() {
        try {
            await navigator.clipboard.writeText(link());
            toast("Link copied. Use it responsibly. You won't.");
        } catch {
            toast(`Copy this link: ${link()}`);
        }
    }

    async function onShare() {
        if (navigator.share) {
            try {
                await navigator.share({ title: "Laugh or Laugh", text: caption, url: link() });
            } catch {
                // Closing the share sheet isn't an error worth reporting.
            }
        } else {
            onCopy();
        }
    }

    return (
        <div className="share-row">
            <button type="button" className="icon-btn" onClick={onDownload} disabled={busy} title="Save a PNG with the caption baked in">
                <Download aria-hidden="true" /> {busy ? "Rendering" : "Download"}
            </button>
            {showLink && (
                <>
                    <button type="button" className="icon-btn" onClick={onCopy} title="Copy a link to this meme's page">
                        <Link2 aria-hidden="true" /> Copy link
                    </button>
                    <button type="button" className="icon-btn" onClick={onShare} title="Spread it. Irresponsibly.">
                        <Share2 aria-hidden="true" /> Share
                    </button>
                </>
            )}
        </div>
    );
}
