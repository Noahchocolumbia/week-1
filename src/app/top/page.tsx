import Link from "next/link";
import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";
import { loadMemes, topMemes } from "@/lib/feed";
import { splitVotes } from "@/lib/format";
import { styleById } from "@/lib/styles";
import { getUserAndProfile, navProps } from "@/lib/supabase-server";

export const metadata = { title: "Hall of Shame · Laugh or Laugh" };

// Public leaderboard. Each row links to the meme's own page.
export default async function TopPage() {
    const { supabase, user, profile } = await getUserAndProfile();
    const { error, memes } = await loadMemes(supabase, user?.id ?? null);
    const top = topMemes(memes, 20);

    return (
        <>
            <NavBar signedIn={Boolean(user)} {...navProps(supabase, profile)} />
            <main className="shell">
                <div className="page-top">
                    <p className="mono" style={{ color: "var(--paper-faint)" }}>
                        Permanent collection, ranked by score
                    </p>
                    <h1 className="display wide page-title">The Hall of Shame</h1>
                    <p className="page-lede">
                        Score is laughs minus mehs. The machine wrote every word. The public decided which ones deserve
                        to be remembered, and which ones deserve this page anyway.
                    </p>
                </div>

                {error ? (
                    <div className="empty">
                        <h2 className="display">Archive offline.</h2>
                        <p>The leaderboard didn&apos;t load. Refresh the page and try again.</p>
                    </div>
                ) : top.length === 0 ? (
                    <div className="empty">
                        <h2 className="display">No shame yet.</h2>
                        <p>Nothing has been posted. That changes when you do.</p>
                    </div>
                ) : (
                    <ol className="ranking">
                        {top.map((meme, index) => {
                            const { laughs, mehs } = splitVotes(meme.score, meme.votes);
                            const style = styleById(meme.style);
                            return (
                                <li key={meme.captionId}>
                                    <Link href={`/m/${meme.captionId}`} className="rank-item">
                                        <span className="rank-num">{String(index + 1).padStart(2, "0")}</span>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={meme.url} alt="" className="rank-thumb" loading="lazy" />
                                        <div>
                                            <p className="rank-caption">{meme.content}</p>
                                            <p className="rank-sub mono">
                                                <span style={{ color: style.color }}>{style.name}</span>
                                                <span>{laughs} {laughs === 1 ? "laugh" : "laughs"}</span>
                                                <span>{mehs} {mehs === 1 ? "meh" : "mehs"}</span>
                                            </p>
                                        </div>
                                        <div className="rank-score">
                                            <strong>{meme.score > 0 ? `+${meme.score}` : meme.score}</strong>
                                            <span className="mono">Score</span>
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                )}

                <div className="button-row" style={{ justifyContent: "flex-start", margin: "40px 0 72px" }}>
                    {user ? (
                        <>
                            <Link href="/rate" className="btn">
                                Judge more memes
                            </Link>
                            <Link href="/generate" className="btn btn-primary">
                                Enter the competition
                            </Link>
                        </>
                    ) : (
                        <Link href="/login" className="btn btn-primary">
                            Sign in to vote
                        </Link>
                    )}
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
