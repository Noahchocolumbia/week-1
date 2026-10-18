import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import PhotoCard, { type Photo } from "@/components/PhotoCard";
import PhotoUploader from "@/components/PhotoUploader";
import { getUserAndProfile, hasName } from "@/lib/supabase-server";

// Gemini can take several seconds, so give the server action room to finish.
export const maxDuration = 60;

type PhotoRow = {
    id: string;
    storage_path: string;
    published: boolean;
    captions: { id: string; content: string }[];
};

// Gated route: only signed-in users can generate captions.
export default async function GeneratePage() {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (!hasName(profile)) redirect("/welcome");

    // Every photo this user has uploaded, newest first, drafts included, plus everyone's totals.
    const [{ data, error }, scores] = await Promise.all([
        supabase
            .from("images")
            .select("id, storage_path, published, captions(id, content)")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false })
            .returns<PhotoRow[]>(),
        supabase.rpc("caption_scores"),
    ]);
    const scoreOf = new Map(
        ((scores.data ?? []) as { caption_id: string; score: number; votes: number }[]).map((s) => [
            s.caption_id,
            { score: Number(s.score), votes: Number(s.votes) },
        ])
    );

    const photos: Photo[] = (data ?? []).map((row) => ({
        id: row.id,
        url: supabase.storage.from("photos").getPublicUrl(row.storage_path).data.publicUrl,
        published: row.published,
        captions: row.captions.map((c) => ({ ...c, ...(scoreOf.get(c.id) ?? { score: 0, votes: 0 }) })),
    }));

    return (
        <>
            <NavBar />
            <main className="content-page">
                <h1 className="pixel-heading page-title">Make a meme</h1>
                <p className="page-intro">
                    Pick a photo and the AI writes three captions. Keep the ones you like, then post them to
                    the feed for everyone to vote on.
                </p>

                <div className="retro-card">
                    <PhotoUploader userId={user.id} />
                </div>

                <h2 className="pixel-heading section-title">Your memes</h2>
                {error ? (
                    <p className="form-error">Something went wrong loading your photos.</p>
                ) : photos.length === 0 ? (
                    <p style={{ color: "var(--text-dim)" }}>Nothing here yet. Add a photo above.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {photos.map((photo) => (
                            <PhotoCard key={photo.id} photo={photo} />
                        ))}
                    </div>
                )}
            </main>
        </>
    );
}
