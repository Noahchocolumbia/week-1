"use client";

import { useEffect, useState } from "react";
import { generateCaptions } from "@/app/actions";
import { createClient } from "@/lib/supabase";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

type Status = "idle" | "uploading" | "thinking" | "done" | "error";

export default function PhotoUploader({ userId }: { userId: string }) {
    const [status, setStatus] = useState<Status>("idle");
    const [message, setMessage] = useState("");
    const [preview, setPreview] = useState<string | null>(null);

    // Free the temporary preview URL when it's replaced or the page is left.
    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    }, [preview]);

    function fail(text: string) {
        setPreview(null);
        setStatus("error");
        setMessage(text);
    }

    async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setMessage("");

        const ext = TYPES[file.type];
        if (!ext) return fail("Choose a JPEG, PNG or WebP photo.");
        if (file.size > MAX_BYTES) return fail("Photo must be under 5 MB.");

        // Show the photo right away, straight from the user's device.
        setPreview(URL.createObjectURL(file));
        setStatus("uploading");

        // 1. The photo goes to Supabase Storage, in a folder named after the user.
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const supabase = createClient();
        const { error } = await supabase.storage
            .from("photos")
            .upload(path, file, { contentType: file.type });
        if (error) return fail("Upload failed. Try again.");

        // 2. The server asks Gemini for captions and saves them as a draft.
        //    The new draft then shows up in "Your photos" below.
        setStatus("thinking");
        const result = await generateCaptions(path);
        if (!result.ok) return fail(result.error);

        setPreview(null);
        setStatus("done");
    }

    const busy = status === "uploading" || status === "thinking";

    return (
        <div>
            {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="The photo you are uploading" className="photo-preview" />
            )}

            <label className="retro-button" style={{ fontSize: "0.6rem", padding: "10px 16px" }} aria-disabled={busy}>
                {status === "uploading"
                    ? "Uploading..."
                    : status === "thinking"
                      ? "Writing captions..."
                      : "Choose a photo"}
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onChange}
                    disabled={busy}
                    className="visually-hidden"
                />
            </label>

            <div aria-live="polite">
                {status === "idle" && <p className="photo-note">JPEG, PNG or WebP, up to 5 MB.</p>}
                {status === "uploading" && <p className="photo-note">Uploading your photo...</p>}
                {status === "thinking" && (
                    <p className="photo-note">The AI is writing captions. This usually takes 10 to 20 seconds.</p>
                )}
                {status === "error" && <p className="form-error">{message}</p>}
                {status === "done" && (
                    <p className="form-success">
                        Captions are ready below. Delete any you don&apos;t want, then post to the feed.
                    </p>
                )}
            </div>
        </div>
    );
}
