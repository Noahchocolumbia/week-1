import "server-only";
import type { createClient } from "@/lib/supabase-server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Vote = 1 | -1 | 0;

export type Meme = {
    captionId: string;
    content: string;
    url: string;
    score: number;
    votes: number;
    myVote: Vote;
};

type ImageRow = {
    id: string;
    storage_path: string;
    captions: { id: string; content: string }[];
};
type ScoreRow = { caption_id: string; score: number; votes: number };
type VoteRow = { caption_id: string; vote: 1 | -1 };

// Every published meme (one per caption) with its totals, and this user's own vote.
// Works logged out too: published memes and their totals are public.
export async function loadMemes(supabase: Supabase, userId: string | null) {
    const [images, scores, myVotes] = await Promise.all([
        supabase
            .from("images")
            .select("id, storage_path, captions(id, content)")
            .eq("published", true)
            .order("created_at", { ascending: false })
            .returns<ImageRow[]>(),
        supabase.rpc("caption_scores"),
        // RLS only returns this user's own votes.
        userId
            ? supabase.from("caption_votes").select("caption_id, vote").returns<VoteRow[]>()
            : Promise.resolve({ data: [] as VoteRow[] }),
    ]);

    if (images.error) return { error: true, memes: [] as Meme[] };

    const scoreOf = new Map(
        ((scores.data ?? []) as ScoreRow[]).map((s) => [
            s.caption_id,
            { score: Number(s.score), votes: Number(s.votes) },
        ])
    );
    const voteOf = new Map((myVotes.data ?? []).map((v) => [v.caption_id, v.vote]));

    // Take the first caption of every photo, then the second, and so on,
    // so the same photo doesn't show up three times in a row.
    const memes: Meme[] = [];
    const rows = images.data ?? [];
    const most = Math.max(0, ...rows.map((image) => image.captions.length));
    for (let i = 0; i < most; i++) {
        for (const image of rows) {
            const caption = image.captions[i];
            if (!caption) continue;
            const totals = scoreOf.get(caption.id) ?? { score: 0, votes: 0 };
            memes.push({
                captionId: caption.id,
                content: caption.content,
                url: supabase.storage.from("photos").getPublicUrl(image.storage_path).data.publicUrl,
                score: totals.score,
                votes: totals.votes,
                myVote: voteOf.get(caption.id) ?? 0,
            });
        }
    }

    return { error: false, memes };
}

// Highest score first; more votes breaks a tie.
export function topMemes(memes: Meme[], count: number) {
    return [...memes]
        .sort((a, b) => b.score - a.score || b.votes - a.votes)
        .slice(0, count);
}
