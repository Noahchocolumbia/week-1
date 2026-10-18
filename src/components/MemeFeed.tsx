"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import VoteButtons from "@/components/VoteButtons";

type Vote = 1 | -1 | 0;

export type FeedMeme = {
    captionId: string;
    content: string;
    url: string;
    score: number;
    votes: number;
    myVote: Vote;
};

// Full-screen memes, one per slide. Swipe or scroll, use the buttons, or press the arrow keys.
// After a new vote the feed moves on by itself.
export default function MemeFeed({ memes: initialMemes, captionFont }: { memes: FeedMeme[]; captionFont: string }) {
    // Keep the order this visit started with. A vote refreshes the page data on the server,
    // and the fresh list (rated memes last) shouldn't reshuffle the feed mid-scroll.
    const [memes] = useState(initialMemes);
    const feedRef = useRef<HTMLElement>(null);
    const [current, setCurrent] = useState(0);
    const [voted, setVoted] = useState(() => new Set(memes.filter((m) => m.myVote !== 0).map((m) => m.captionId)));

    // The last slide is the "all caught up" screen.
    const lastIndex = memes.length;
    const left = memes.length - voted.size;

    const goTo = useCallback(
        (index: number) => {
            const feed = feedRef.current;
            if (!feed) return;
            const clamped = Math.max(0, Math.min(lastIndex, index));
            feed.children[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        [lastIndex]
    );

    // Keep track of which slide is on screen.
    useEffect(() => {
        const feed = feedRef.current;
        if (!feed) return;
        const onScroll = () => setCurrent(Math.round(feed.scrollTop / feed.clientHeight));
        feed.addEventListener("scroll", onScroll, { passive: true });
        return () => feed.removeEventListener("scroll", onScroll);
    }, []);

    // Arrow keys (and j/k) move between memes on a laptop.
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select")) return;
            if (event.key === "ArrowDown" || event.key === "j") {
                event.preventDefault();
                goTo(current + 1);
            } else if (event.key === "ArrowUp" || event.key === "k") {
                event.preventDefault();
                goTo(current - 1);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [current, goTo]);

    function onVoted(captionId: string, index: number, vote: Vote) {
        const wasNew = !voted.has(captionId);
        setVoted((prev) => {
            const next = new Set(prev);
            if (vote === 0) next.delete(captionId);
            else next.add(captionId);
            return next;
        });
        // A first vote on this meme moves the feed along; changing or undoing a vote doesn't.
        if (wasNew && vote !== 0) setTimeout(() => goTo(index + 1), 450);
    }

    return (
        <div className="feed-shell">
            <p className="feed-progress" aria-live="polite">
                {left > 0 ? `${left} left to rate` : "All rated"}
            </p>

            <main ref={feedRef} className="meme-feed" aria-label="Memes to rate">
                {memes.map((meme, index) => (
                    <section key={meme.captionId} className="meme-slide" aria-label={`Meme ${index + 1} of ${memes.length}`}>
                        <div className="meme-card">
                            <p className={`meme-caption ${captionFont}`}>{meme.content}</p>
                            <div className="meme-frame">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={meme.url}
                                    alt={`Photo for the caption: ${meme.content}`}
                                    loading={index < 2 ? "eager" : "lazy"}
                                />
                                <span className="meme-count">
                                    {index + 1} / {memes.length}
                                </span>
                            </div>
                        </div>
                        <VoteButtons
                            captionId={meme.captionId}
                            initialScore={meme.score}
                            initialVotes={meme.votes}
                            initialVote={meme.myVote}
                            onVoted={(vote) => onVoted(meme.captionId, index, vote)}
                        />
                        <div className="feed-controls">
                            <button
                                type="button"
                                className="small-button"
                                onClick={() => goTo(index - 1)}
                                disabled={index === 0}
                            >
                                ↑ Prev
                            </button>
                            <span className="feed-tip">Swipe, scroll or use arrow keys</span>
                            <button type="button" className="small-button" onClick={() => goTo(index + 1)}>
                                {index === memes.length - 1 ? "Finish ↓" : "Next ↓"}
                            </button>
                        </div>
                    </section>
                ))}

                <section className="meme-slide feed-end">
                    <div className="retro-card" style={{ textAlign: "center", maxWidth: "440px" }}>
                        <span className="retro-badge">[ALL CAUGHT UP]</span>
                        <h2 className="pixel-heading" style={{ fontSize: "1rem", margin: "1.5rem 0 1rem", lineHeight: 1.6 }}>
                            {left > 0 ? `${left} still unrated` : "You rated them all"}
                        </h2>
                        <p style={{ color: "var(--text-dim)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                            See which captions are winning, or add a photo of your own.
                        </p>
                        <div className="home-actions">
                            <Link href="/top" className="retro-button">
                                Top memes <span className="arrow">&gt;</span>
                            </Link>
                            <Link href="/generate" className="retro-button">
                                Make a meme <span className="arrow">&gt;</span>
                            </Link>
                            <button type="button" className="link-button" onClick={() => goTo(0)}>
                                Back to the first meme
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
