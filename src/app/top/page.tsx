import { Anton } from "next/font/google";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { loadMemes, topMemes } from "@/lib/feed";
import { getUserAndProfile } from "@/lib/supabase-server";

const memeFont = Anton({ weight: "400", subsets: ["latin"] });

export const metadata = { title: "Top memes · Laugh or Laugh" };

// Public leaderboard: anyone can see which captions are winning.
export default async function TopPage() {
    const { supabase, user } = await getUserAndProfile();
    const { error, memes } = await loadMemes(supabase, user?.id ?? null);
    const top = topMemes(memes, 10);

    return (
        <>
            <NavBar signedIn={Boolean(user)} />
            <main className="content-page">
                <h1 className="pixel-heading page-title">Top memes</h1>
                <p className="page-intro">
                    Ranked by score: upvotes minus downvotes. Every caption was written by AI.
                </p>

                {error ? (
                    <p className="form-error">Something went wrong loading the leaderboard.</p>
                ) : top.length === 0 ? (
                    <p className="page-intro">No memes yet.</p>
                ) : (
                    <ol className="top-list">
                        {top.map((meme, index) => (
                            <li key={meme.captionId} className="top-row">
                                <span className={`top-rank ${index < 3 ? "top-rank-medal" : ""}`}>
                                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                                </span>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={meme.url} alt="" className="top-thumb" loading="lazy" />
                                <p className={`top-caption ${memeFont.className}`}>{meme.content}</p>
                                <span className="top-score">
                                    <strong>{meme.score > 0 ? `+${meme.score}` : meme.score}</strong>
                                    <span>
                                        {meme.votes} {meme.votes === 1 ? "vote" : "votes"}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ol>
                )}

                <div className="button-row" style={{ justifyContent: "center", marginTop: "2.5rem" }}>
                    {user ? (
                        <>
                            <Link href="/rate" className="retro-button">
                                Rate more <span className="arrow">&gt;</span>
                            </Link>
                            <Link href="/generate" className="retro-button">
                                Make a meme <span className="arrow">&gt;</span>
                            </Link>
                        </>
                    ) : (
                        <Link href="/login" className="retro-button">
                            Sign in to vote <span className="arrow">&gt;</span>
                        </Link>
                    )}
                </div>
            </main>
        </>
    );
}
