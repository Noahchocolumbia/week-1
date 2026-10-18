import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";
import Studio, { type StudioImage } from "@/components/Studio";
import { isFormat } from "@/lib/styles";
import { getUserAndProfile, hasName, navProps } from "@/lib/supabase-server";

// Gemini can take several seconds, so give the server actions room to finish.
export const maxDuration = 60;

export const metadata = { title: "Studio · Laugh or Laugh" };

type PhotoRow = {
    id: string;
    storage_path: string;
    published: boolean;
    style: string;
    format: string;
    captions: { id: string; content: string; edited: boolean; created_at: string }[];
};

// Gated route: only signed-in users can make memes.
export default async function GeneratePage({ searchParams }: PageProps<"/generate">) {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (!hasName(profile)) redirect("/welcome");

    // An idea typed into the homepage prompt box arrives here.
    const { idea } = await searchParams;
    const initialIdea = typeof idea === "string" ? idea.slice(0, 200) : "";

    // Every photo this user has uploaded, newest first, plus everyone's totals.
    const [{ data }, scores] = await Promise.all([
        supabase
            .from("images")
            .select("id, storage_path, published, style, format, captions(id, content, edited, created_at)")
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

    const images: StudioImage[] = (data ?? []).map((row) => ({
        id: row.id,
        url: supabase.storage.from("photos").getPublicUrl(row.storage_path).data.publicUrl,
        style: row.style,
        format: isFormat(row.format) ? row.format : "top",
        published: row.published,
        captions: [...row.captions]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((c) => ({ id: c.id, content: c.content, edited: c.edited, ...(scoreOf.get(c.id) ?? { score: 0, votes: 0 }) })),
    }));

    return (
        <>
            <NavBar {...navProps(supabase, profile)} />
            <main className="shell" style={{ paddingBottom: 96 }}>
                <div className="page-top">
                    <p className="mono" style={{ color: "var(--paper-faint)" }}>
                        Meme generation studio
                    </p>
                    <h1 className="display wide page-title">The studio</h1>
                    <p className="page-lede">
                        A professional creative tool that has been hijacked by internet trolls. Upload a photo, pick a
                        humor style, and Gemini writes three captions you can edit, remix, export, or unleash.
                    </p>
                </div>
                <Studio
                    userId={user.id}
                    drafts={images.filter((i) => !i.published)}
                    posted={images.filter((i) => i.published)}
                    initialIdea={initialIdea}
                />
            </main>
        </>
    );
}
