import { Anton } from "next/font/google";
import Link from "next/link";
import EmojiRain from "@/components/EmojiRain";
import VoteButtons from "@/components/VoteButtons";
import { loadMemes, topMemes } from "@/lib/feed";
import { getUserAndProfile } from "@/lib/supabase-server";

const memeFont = Anton({ weight: "400", subsets: ["latin"] });

export default async function Home() {
    const { supabase, user, profile } = await getUserAndProfile();
    const { memes } = await loadMemes(supabase, user?.id ?? null);
    const preview = topMemes(memes, 3);

    return (
        <>
            <EmojiRain />
            <main className="home-page">
                <div className="retro-card home">
                    <span className="retro-badge">{user ? "[SIGNED IN]" : "[AI MEME FEED]"}</span>
                    <h1 className="pixel-heading home-title">Laugh or Laugh</h1>
                    <p className="home-tagline">
                        {user && profile?.first_name ? `Welcome back, ${profile.first_name}. ` : ""}
                        AI writes the captions. You decide which ones actually land.
                    </p>

                    {!user && (
                        <ol className="home-steps">
                            <li>
                                <span aria-hidden="true">📸</span>
                                Upload a photo
                            </li>
                            <li>
                                <span aria-hidden="true">🤖</span>
                                AI writes three captions
                            </li>
                            <li>
                                <span aria-hidden="true">👍</span>
                                Everyone votes
                            </li>
                        </ol>
                    )}

                    {user ? (
                        <div className="home-actions">
                            <Link href="/rate" className="retro-button">
                                Rate memes <span className="arrow">&gt;</span>
                            </Link>
                            <Link href="/generate" className="retro-button">
                                Make a meme <span className="arrow">&gt;</span>
                            </Link>
                            <div className="home-links">
                                <Link href="/top" className="link-button">
                                    Top memes
                                </Link>
                                <Link href="/profile" className="link-button">
                                    Profile
                                </Link>
                                <form action="/auth/signout" method="post">
                                    <button type="submit" className="link-button">
                                        Sign out
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="home-actions">
                            <Link href="/login" className="retro-button">
                                Sign in to vote <span className="arrow">&gt;</span>
                            </Link>
                            <p className="home-fine">Free. Sign in with any Google account, including LionMail.</p>
                        </div>
                    )}
                </div>

                {preview.length > 0 && (
                    <section className="home-preview" aria-labelledby="preview-heading">
                        <div className="home-preview-head">
                            <h2 id="preview-heading" className="pixel-heading">
                                Top right now
                            </h2>
                            <Link href="/top" className="link-button">
                                Full leaderboard &gt;
                            </Link>
                        </div>
                        <div className="preview-grid">
                            {preview.map((meme) => (
                                <article key={meme.captionId} className="preview-card">
                                    <p className={`meme-caption preview-caption ${memeFont.className}`}>
                                        {meme.content}
                                    </p>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={meme.url} alt={`Photo for the caption: ${meme.content}`} />
                                    <div className="preview-votes">
                                        <VoteButtons
                                            captionId={meme.captionId}
                                            initialScore={meme.score}
                                            initialVotes={meme.votes}
                                            initialVote={meme.myVote}
                                            signedIn={Boolean(user)}
                                        />
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </>
    );
}
