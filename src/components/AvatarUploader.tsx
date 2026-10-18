"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveAvatarPath } from "@/app/actions";
import { createClient } from "@/lib/supabase";

const MAX_BYTES = 5 * 1024 * 1024;

// The "mugshot" on the profile page, with a button to replace it.
export default function AvatarUploader({
    userId,
    avatarUrl,
    initial,
}: {
    userId: string;
    avatarUrl: string | null;
    initial: string;
}) {
    const router = useRouter();
    const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
    const [message, setMessage] = useState("");

    async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setStatus("error");
            setMessage("Error: choose an image file.");
            return;
        }
        if (file.size > MAX_BYTES) {
            setStatus("error");
            setMessage("Error: photo must be under 5 MB.");
            return;
        }

        setStatus("uploading");
        setMessage("");

        // The file goes to Supabase Storage, in a folder named after the user.
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/avatar-${Date.now()}.${ext}`;

        const supabase = createClient();
        const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });

        // The database only stores the path to the file.
        const saved = error ? { ok: false } : await saveAvatarPath(path);

        if (!saved.ok) {
            setStatus("error");
            setMessage("Error: upload failed. Try again.");
            return;
        }

        setStatus("idle");
        router.refresh();
    }

    return (
        <>
            {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Your profile photo" className="mugshot" />
            ) : (
                <div className="mugshot" aria-hidden="true">
                    {initial}
                </div>
            )}
            <div>
                <label className="btn btn-small" style={{ width: "100%" }}>
                    {status === "uploading" ? "Uploading..." : avatarUrl ? "New mugshot" : "Add a mugshot"}
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={onChange}
                        disabled={status === "uploading"}
                        className="visually-hidden"
                    />
                </label>
                {status === "error" && <p className="form-error">{message}</p>}
            </div>
        </>
    );
}
