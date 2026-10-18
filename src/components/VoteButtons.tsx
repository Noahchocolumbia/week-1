"use client";

import Link from "next/link";
import { useState } from "react";
import { castVote } from "@/app/actions";
import { splitVotes } from "@/lib/format";

type Vote = 1 | -1 | 0;

const LAUGH_LINES = ["Laugh logged.", "Verdict: funny.", "A chuckle has been recorded.", "The algorithm is proud of itself."];
const MEH_LINES = ["Meh filed.", "Verdict: not it.", "The AI has been notified. It's fine.", "Comedic value: denied."];

// The reaction bar under every meme: Laugh is an upvote, Meh is a downvote.
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
    const [line, setLine] = useState("");

    const { laughs, mehs } = splitVotes(score, votes);

    async function onVote(pressed: 1 | -1) {
        if (saving) return;

        // Pressing the reaction you already chose takes it back.
        const next: Vote = pressed === vote ? 0 : pressed;

        // Update the screen right away, then confirm with the server.
        const before = { score, votes, vote };
        setScore(score + next - vote);
        setVotes(votes + (next !== 0 ? 1 : 0) - (vote !== 0 ? 1 : 0));
        setVote(next);
        setSaving(true);
        setFailed(false);
        const pool = next === 1 ? LAUGH_LINES : MEH_LINES;
        setLine(next === 0 ? "Verdict withdrawn." : pool[Math.floor(Math.random() * pool.length)]);

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

    const scoreBox = (
        <div className="score-box" title="Laughs minus mehs">
            <strong>{score > 0 ? `+${score}` : score}</strong>
            <span className="mono">Score</span>
        </div>
    );

    // Logged-out visitors see the counts; the reactions send them to sign in.
    if (!signedIn) {
        return (
            <div className="reactions">
                <Link href="/login" className="reaction reaction-laugh" title="Sign in to laugh">
                    <span className="face" aria-hidden="true">😂</span>
                    Laugh <b>{laughs}</b>
                </Link>
                <Link href="/login" className="reaction reaction-meh" title="Sign in to meh">
                    <span className="face" aria-hidden="true">😐</span>
                    Meh <b>{mehs}</b>
                </Link>
                {scoreBox}
            </div>
        );
    }

    return (
        <div>
            <div className="reactions">
                <button
                    type="button"
                    className="reaction reaction-laugh"
                    aria-pressed={vote === 1}
                    onClick={() => onVote(1)}
                    title={vote === 1 ? "Take the laugh back" : "It got you"}
                >
                    <span className="face" aria-hidden="true">😂</span>
                    Laugh <b>{laughs}</b>
                </button>
                <button
                    type="button"
                    className="reaction reaction-meh"
                    aria-pressed={vote === -1}
                    onClick={() => onVote(-1)}
                    title={vote === -1 ? "Take the meh back" : "It didn't"}
                >
                    <span className="face" aria-hidden="true">😐</span>
                    Meh <b>{mehs}</b>
                </button>
                {scoreBox}
            </div>
            <p className="reaction-status mono" role={failed ? "alert" : undefined}>
                {failed
                    ? "Error: verdict not saved. Try again."
                    : vote !== 0
                      ? `${line || "Verdict recorded."} Tap again to undo.`
                      : " "}
            </p>
        </div>
    );
}
