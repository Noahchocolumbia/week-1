import MemeImage from "@/components/MemeImage";
import ShareControls from "@/components/ShareControls";
import VoteButtons from "@/components/VoteButtons";
import { modelName } from "@/lib/format";
import { styleById, type MemeFormat } from "@/lib/styles";

type Vote = 1 | -1 | 0;

export type PostMeme = {
    captionId: string;
    content: string;
    url: string;
    score: number;
    votes: number;
    myVote: Vote;
    model: string;
    edited: boolean;
    style: string;
    format: MemeFormat;
    ago: string;
};

// One meme with its credits, reactions and share controls.
// "exhibit" is the gallery version, labelled like a museum piece.
export default function PostCard({
    meme,
    signedIn,
    variant = "feed",
    exhibit,
    eager = false,
    onVoted,
}: {
    meme: PostMeme;
    signedIn: boolean;
    variant?: "feed" | "exhibit";
    exhibit?: number;
    eager?: boolean;
    onVoted?: (vote: Vote) => void;
}) {
    const style = styleById(meme.style);

    return (
        <article className="post">
            {variant === "exhibit" ? (
                <div className="exhibit-label mono">
                    <span>Exhibit {String(exhibit ?? 0).padStart(3, "0")}</span>
                    <span style={{ color: style.color }}>{style.name}</span>
                </div>
            ) : (
                <header className="post-head mono">
                    <span style={{ color: style.color }}>{style.name}</span>
                    <span title={`Caption by ${modelName(meme.model)}`}>{meme.ago}</span>
                </header>
            )}

            <div style={variant === "exhibit" ? { padding: "10px 14px 0" } : undefined}>
                <MemeImage
                    url={meme.url}
                    caption={meme.content}
                    format={meme.format}
                    size={variant === "exhibit" ? "small" : "medium"}
                    eager={eager}
                />
            </div>

            <footer className="post-foot">
                <VoteButtons
                    captionId={meme.captionId}
                    initialScore={meme.score}
                    initialVotes={meme.votes}
                    initialVote={meme.myVote}
                    signedIn={signedIn}
                    onVoted={onVoted}
                />
                <ShareControls
                    captionId={meme.captionId}
                    url={meme.url}
                    caption={meme.content}
                    format={meme.format}
                    compact={variant === "feed"}
                />
                {meme.edited && variant === "exhibit" && (
                    <p className="mono human-tag" style={{ marginTop: 8 }}>Edited by a human. Blame them.</p>
                )}
            </footer>
        </article>
    );
}
