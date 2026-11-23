import Link from "next/link";
import NavBar from "@/components/NavBar";
import PostCard from "@/components/PostCard";
import { loadMemes, pickRange, postedWithin, RANGES, topMemes } from "@/lib/feed";
import { getUserAndProfile, navProps } from "@/lib/supabase-server";

// The homepage is the feed as a grid: the best memes from the chosen time window, highest score first.
// The tabs are plain links (?range=week, ?range=all, ...), so they work without any client JavaScript.
// Memes per page; "Show 9 more" adds another batch (?show=18, 27, ...).
const PAGE = 9;

export default async function Home({
    searchParams,
}: {
    searchParams: Promise<{ range?: string | string[]; show?: string | string[] }>;
}) {
    const { range: rangeParam, show: showParam } = await searchParams;

    const { supabase, user, profile } = await getUserAndProfile();
    const { error, memes } = await loadMemes(supabase, user?.id ?? null);

    // With no tab picked, start on the shortest window that has something in it,
    // so the homepage never opens on an empty "Past week".
    const range = rangeParam
        ? pickRange(rangeParam)
        : (RANGES.find((r) => postedWithin(memes, r).length > 0) ?? pickRange(undefined));
    const ranked = topMemes(postedWithin(memes, range), memes.length);
    const requested = Number(Array.isArray(showParam) ? showParam[0] : showParam);
    const show = Number.isFinite(requested) && requested > PAGE ? Math.ceil(requested / PAGE) * PAGE : PAGE;
    const visible = ranked.slice(0, show);
    const signedIn = Boolean(user);

    return (
        <>
            <NavBar signedIn={signedIn} {...navProps(supabase, profile)} />
            <main className="shell">
                <h1 className="visually-hidden">Top memes, {range.label.toLowerCase()}</h1>

                <div className="home">
                    <nav className="feed-progress range-bar mono" aria-label="Time range">
                        <div className="range-tabs">
                            {RANGES.map((r) => (
                                <Link
                                    key={r.id}
                                    href={`/?range=${r.id}`}
                                    scroll={false}
                                    className="range-tab"
                                    aria-current={r.id === range.id ? "page" : undefined}
                                >
                                    {r.label}
                                </Link>
                            ))}
                        </div>
                        <span className="range-count">{ranked.length} ranked</span>
                    </nav>

                    {error ? (
                        <div className="empty">
                            <h2 className="display">Feed offline.</h2>
                            <p>The memes didn&apos;t load. Refresh the page and try again.</p>
                        </div>
                    ) : ranked.length === 0 ? (
                        <div className="empty">
                            <h2 className="display">Quiet {range.id === "all" ? "forever" : range.label.toLowerCase()}.</h2>
                            <p>Nothing was posted in this window. Somebody has to go first.</p>
                            <div className="button-row">
                                {range.id !== "all" && (
                                    <Link href="/?range=all" className="btn" scroll={false}>
                                        See all time
                                    </Link>
                                )}
                                <Link href={signedIn ? "/generate" : "/login"} className="btn btn-primary">
                                    Make one
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="home-grid">
                            {visible.map((meme, index) => (
                                <PostCard key={meme.captionId} meme={meme} signedIn={signedIn} eager={index < 3} />
                            ))}
                        </div>
                    )}

                    {visible.length < ranked.length && (
                        <div className="button-row home-more">
                            <Link href={`/?range=${range.id}&show=${show + PAGE}`} scroll={false} className="btn">
                                Show {Math.min(PAGE, ranked.length - visible.length)} more
                            </Link>
                            <span className="mono range-count">
                                {visible.length} of {ranked.length}
                            </span>
                        </div>
                    )}

                    <Link href={signedIn ? "/generate" : "/login"} className="btn btn-primary generate-fab">
                        Generate captions
                    </Link>
                </div>
            </main>
        </>
    );
}
