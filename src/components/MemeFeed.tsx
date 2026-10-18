"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import PostCard, { type PostMeme } from "@/components/PostCard";

type Vote = 1 | -1 | 0;

function postsIn(list: HTMLElement | null) {
    return Array.from(list?.querySelectorAll<HTMLElement>("[data-post]") ?? []);
}

function scrollToPost(list: HTMLElement | null, index: number) {
    const all = postsIn(list);
    all[Math.max(0, Math.min(all.length - 1, index))]?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// The post nearest the top of the screen.
function currentIndex(list: HTMLElement | null) {
    let best = 0;
    let bestDistance = Infinity;
    postsIn(list).forEach((el, i) => {
        const distance = Math.abs(el.getBoundingClientRect().top - 150);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
        }
    });
    return best;
}

// The signed-in feed. Reacting to a post scrolls to the next one,
// and J / K (or the arrow keys) move between posts on a laptop.
export default function MemeFeed({ memes: initialMemes }: { memes: PostMeme[] }) {
    // Keep the order this visit started with. A vote refreshes the page data on the server,
    // and the fresh list (rated memes last) shouldn't reshuffle the feed mid-scroll.
    const [memes] = useState(initialMemes);
    const [voted, setVoted] = useState(() => new Set(memes.filter((m) => m.myVote !== 0).map((m) => m.captionId)));
    const listRef = useRef<HTMLDivElement>(null);

    const total = memes.length;
    const done = voted.size;
    const left = total - done;
    const percent = total ? Math.round((done / total) * 100) : 0;

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            const target = event.target as HTMLElement;
            if (target.closest("input, textarea, select") || event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key === "j" || event.key === "ArrowDown") {
                event.preventDefault();
                scrollToPost(listRef.current, currentIndex(listRef.current) + 1);
            } else if (event.key === "k" || event.key === "ArrowUp") {
                event.preventDefault();
                scrollToPost(listRef.current, currentIndex(listRef.current) - 1);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    function onVoted(captionId: string, index: number, vote: Vote) {
        const wasNew = !voted.has(captionId);
        setVoted((prev) => {
            const next = new Set(prev);
            if (vote === 0) next.delete(captionId);
            else next.add(captionId);
            return next;
        });
        // A first reaction moves you along; changing or taking one back doesn't.
        if (wasNew && vote !== 0) setTimeout(() => scrollToPost(listRef.current, index + 1), 550);
    }

    const status = left > 0 ? `${left} pending` : "Docket clear";

    return (
        <div className="feed-layout">
            <div>
                <div className="feed-sticky mono" aria-live="polite">
                    <span>{status}</span>
                    <div className="meter" aria-hidden="true">
                        <div style={{ width: `${percent}%` }} />
                    </div>
                </div>

                <div className="feed-column" ref={listRef}>
                    {memes.map((meme, index) => (
                        <div key={meme.captionId} data-post>
                            <PostCard
                                meme={meme}
                                signedIn
                                eager={index < 2}
                                onVoted={(vote) => onVoted(meme.captionId, index, vote)}
                            />
                        </div>
                    ))}

                    <div className="end-panel" data-post>
                        <h2 className="display wide">{left > 0 ? `${left} still waiting` : "Docket clear."}</h2>
                        <p>
                            {left > 0
                                ? "Some memes are still awaiting your judgment. Scroll up and deliver it."
                                : "Every meme has your verdict. Society thanks you. Society is confused, but thanks you."}
                        </p>
                        <div className="button-row">
                            <Link href="/top" className="btn">
                                Hall of Shame
                            </Link>
                            <Link href="/generate" className="btn btn-primary">
                                Commit a new meme
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <aside className="feed-aside" aria-label="Your progress">
                <div className="panel">
                    <p className="panel-title mono">Verdicts pending</p>
                    <p className="big-number" aria-live="polite">
                        {left}
                    </p>
                    <div className="meter" aria-hidden="true">
                        <div style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mono" style={{ marginTop: 10, color: "var(--paper-faint)" }}>
                        {done} of {total} judged. {percent}% of your afternoon gone.
                    </p>
                </div>
                <div className="panel keys">
                    <p className="panel-title mono">Controls</p>
                    <p>
                        <kbd>J</kbd>
                        <kbd>K</kbd> next and previous meme
                    </p>
                    <p style={{ marginTop: 8, color: "var(--paper-dim)" }}>
                        Laugh or meh moves you along. Tap the same one again to take it back.
                    </p>
                </div>
                <div className="panel">
                    <p className="panel-title mono">System diagnostics</p>
                    <p className="mono" style={{ color: "var(--paper-dim)", lineHeight: 1.9 }}>
                        Brain cells remaining: 2<br />
                        Irony levels: nominal<br />
                        <span style={{ color: "var(--red)" }}>Touch grass: overdue</span>
                    </p>
                </div>
            </aside>
        </div>
    );
}
