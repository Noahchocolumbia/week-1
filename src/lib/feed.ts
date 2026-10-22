import "server-only";
import { timeAgo } from "@/lib/format";
import { isFormat, type MemeFormat } from "@/lib/styles";
import type { createClient } from "@/lib/supabase-server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Vote = 1 | -1 | 0;

export type Meme = {
    captionId: string;
    imageId: string;
    content: string;
    url: string;
    score: number;
    votes: number;
    myVote: Vote;
    // Which AI model wrote the caption, and whether a person rewrote it afterwards.
    model: string;
    edited: boolean;
    style: string;
    format: MemeFormat;
    postedAt: string;
    // Worked out on the server so the browser doesn't render a different time.
    ago: string;
};

type CaptionRow = { id: string; content: string; model: string; edited: boolean };
type ImageRow = {
    id: string;
    storage_path: string;
    created_at: string;
    style: string;
    format: string;
    captions: CaptionRow[];
};
type ScoreRow = { caption_id: string; score: number; votes: number };
type VoteRow = { caption_id: string; vote: 1 | -1 };

const IMAGE_FIELDS = "id, storage_path, created_at, style, format, captions(id, content, model, edited)";

// Every caption's score and vote count, from the aggregate RPC. Shared by the
// feed, the share page, and the studio so they all build the map the same way.
export async function loadScores(supabase: Supabase) {
    const scores = await supabase.rpc("caption_scores");
    return new Map(
        ((scores.data ?? []) as ScoreRow[]).map((s) => [s.caption_id, { score: Number(s.score), votes: Number(s.votes) }])
    );
}

async function totalsAndVotes(supabase: Supabase, userId: string | null) {
    const [scoreOf, myVotes] = await Promise.all([
        loadScores(supabase),
        // RLS only returns this user's own votes.
        userId
            ? supabase.from("caption_votes").select("caption_id, vote").returns<VoteRow[]>()
            : Promise.resolve({ data: [] as VoteRow[] }),
    ]);
    const voteOf = new Map((myVotes.data ?? []).map((v) => [v.caption_id, v.vote]));
    return { scoreOf, voteOf };
}

function toMeme(
    supabase: Supabase,
    image: ImageRow,
    caption: CaptionRow,
    scoreOf: Map<string, { score: number; votes: number }>,
    voteOf: Map<string, 1 | -1>
): Meme {
    const totals = scoreOf.get(caption.id) ?? { score: 0, votes: 0 };
    return {
        captionId: caption.id,
        imageId: image.id,
        content: caption.content,
        url: supabase.storage.from("photos").getPublicUrl(image.storage_path).data.publicUrl,
        score: totals.score,
        votes: totals.votes,
        myVote: voteOf.get(caption.id) ?? 0,
        model: caption.model,
        edited: caption.edited,
        style: image.style,
        format: isFormat(image.format) ? image.format : "top",
        postedAt: image.created_at,
        ago: timeAgo(image.created_at),
    };
}

// Every published meme (one per caption) with its totals, and this user's own vote.
// Works logged out too: published memes and their totals are public.
export async function loadMemes(supabase: Supabase, userId: string | null) {
    const [images, { scoreOf, voteOf }] = await Promise.all([
        supabase
            .from("images")
            .select(IMAGE_FIELDS)
            .eq("published", true)
            .order("created_at", { ascending: false })
            .returns<ImageRow[]>(),
        totalsAndVotes(supabase, userId),
    ]);

    if (images.error) return { error: true, memes: [] as Meme[] };

    // Take the first caption of every photo, then the second, and so on,
    // so the same photo doesn't show up three times in a row.
    const memes: Meme[] = [];
    const rows = images.data ?? [];
    const most = Math.max(0, ...rows.map((image) => image.captions.length));
    for (let i = 0; i < most; i++) {
        for (const image of rows) {
            const caption = image.captions[i];
            if (caption) memes.push(toMeme(supabase, image, caption, scoreOf, voteOf));
        }
    }

    return { error: false, memes };
}

// One published meme, for its share page.
export async function loadMeme(supabase: Supabase, captionId: string, userId: string | null) {
    const { data: caption } = await supabase
        .from("captions")
        .select("id, image_id")
        .eq("id", captionId)
        .maybeSingle<{ id: string; image_id: string }>();
    if (!caption) return null;

    const [{ data: image }, { scoreOf, voteOf }] = await Promise.all([
        supabase
            .from("images")
            .select(IMAGE_FIELDS)
            .eq("id", caption.image_id)
            .eq("published", true)
            .maybeSingle<ImageRow>(),
        totalsAndVotes(supabase, userId),
    ]);
    const row = image?.captions.find((c) => c.id === captionId);
    if (!image || !row) return null;

    return toMeme(supabase, image, row, scoreOf, voteOf);
}

// Highest score first; more votes breaks a tie.
export function topMemes(memes: Meme[], count: number) {
    return [...memes].sort((a, b) => b.score - a.score || b.votes - a.votes).slice(0, count);
}
