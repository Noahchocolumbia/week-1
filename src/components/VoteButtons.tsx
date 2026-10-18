"use client";

import Link from "next/link";
import { useState } from "react";
import { castVote } from "@/app/actions";

type Vote = 1 | -1 | 0;

export default function VoteButtons({
    captionId,
    initialScore,
    initialVotes,
    initialVote,
    signedIn = true,
    onVoted,
}: {
    captionId: string;
    initialScore: number;
    initialVotes: number;
    initialVote: Vote;
    signedIn?: boolean;
    // Called after a vote is saved, with the new vote (0 = taken back).
    onVoted?: (vote: Vote) => void;
}) {
    const [score, setScore] = useState(initialScore);
    const [votes, setVotes] = useState(initialVotes);
    const [vote, setVote] = useState<Vote>(initialVote);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);

    async function onVote(pressed: 1 | -1) {
        if (saving) return;

        // Pressing the thumb you already chose takes the vote back.
        const next: Vote = pressed === vote ? 0 : pressed;

        // Update the screen right away, then confirm with the server.
        const before = { score, votes, vote };
        setScore(score + next - vote);
        setVotes(votes + (next !== 0 ? 1 : 0) - (vote !== 0 ? 1 : 0));
        setVote(next);
        setSaving(true);
        setFailed(false);

        const result = await castVote(captionId, next);

        // If the save didn't go through, put things back the way they were.
        if (!result.ok) {
            setScore(before.score);
            setVotes(before.votes);
            setVote(before.vote);
            setFailed(true);
        } else {
            onVoted?.(next);
        }
        setSaving(false);
    }

    const tally = (
        <span className="vote-tally" title="Upvotes minus downvotes">
            <span className="vote-score">{score > 0 ? `+${score}` : score}</span>
            <span className="vote-count">
                {votes} {votes === 1 ? "vote" : "votes"}
            </span>
        </span>
    );

    // Logged-out visitors see the totals, and the thumbs send them to sign in.
    if (!signedIn) {
        return (
            <div className="vote-box">
                <Link href="/login" className="vote-button" aria-label="Sign in to upvote">
                    <span aria-hidden="true">👍</span>
                    <span className="vote-label">Upvote</span>
                </Link>
                {tally}
                <Link href="/login" className="vote-button vote-down" aria-label="Sign in to downvote">
                    <span aria-hidden="true">👎</span>
                    <span className="vote-label">Downvote</span>
                </Link>
            </div>
        );
    }

    return (
        <div className="vote-wrap">
            <div className="vote-box">
                <button
                    type="button"
                    className="vote-button"
                    aria-label={vote === 1 ? "Upvoted. Press again to take it back" : "Upvote"}
                    aria-pressed={vote === 1}
                    onClick={() => onVote(1)}
                >
                    <span aria-hidden="true">👍</span>
                    <span className="vote-label">Upvote</span>
                </button>
                {tally}
                <button
                    type="button"
                    className="vote-button vote-down"
                    aria-label={vote === -1 ? "Downvoted. Press again to take it back" : "Downvote"}
                    aria-pressed={vote === -1}
                    onClick={() => onVote(-1)}
                >
                    <span aria-hidden="true">👎</span>
                    <span className="vote-label">Downvote</span>
                </button>
            </div>
            <p className="vote-status" role={failed ? "alert" : undefined}>
                {failed ? "Vote didn't save. Try again." : vote !== 0 ? "Tap again to undo" : " "}
            </p>
        </div>
    );
}
