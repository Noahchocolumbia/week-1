"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Magnetic from "@/components/Magnetic";
import MemeImage from "@/components/MemeImage";
import type { PostMeme } from "@/components/PostCard";
import { promptQuip } from "@/lib/styles";

const lineUp = {
    hidden: { y: "105%" },
    show: (i: number) => ({ y: "0%", transition: { delay: 0.08 + i * 0.11, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] as const } }),
};

// The one orchestrated moment on the site: the headline rises line by line on load.
export function HeroHeadline() {
    const lines = [
        { text: "Make", className: "wide" },
        { text: "something", className: "" },
        { text: "stupid.", className: "stupid" },
    ];
    return (
        <h1 className="display hero-title">
            {lines.map((line, i) => (
                <span key={line.text} className="line">
                    <motion.span className={line.className} variants={lineUp} initial="hidden" animate="show" custom={i}>
                        {line.text}
                    </motion.span>
                </span>
            ))}
        </h1>
    );
}

// The prompt box: an idea typed here is carried into the studio.
export function HeroPrompt({ signedIn }: { signedIn: boolean }) {
    const router = useRouter();
    const [idea, setIdea] = useState("");
    const quip = promptQuip(idea);

    function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!signedIn) {
            router.push("/login");
            return;
        }
        const params = new URLSearchParams();
        if (idea.trim()) params.set("idea", idea.trim().slice(0, 200));
        router.push(`/generate${params.size ? `?${params}` : ""}`);
    }

    return (
        <form onSubmit={onSubmit}>
            <div className="prompt-box">
                <label>
                    <span className="caret" aria-hidden="true">
                        &gt;
                    </span>
                    <span className="visually-hidden">Describe the meme you want</span>
                    <input
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="my roommate's sourdough starter has a LinkedIn"
                        maxLength={200}
                    />
                </label>
                <Magnetic>
                    <button type="submit" className="btn btn-primary btn-big" title="Point of no return">
                        Generate brainrot →
                    </button>
                </Magnetic>
            </div>
            <p className="mono quip" aria-live="polite" style={{ minHeight: "1.4em" }}>
                {quip ?? ""}
            </p>
        </form>
    );
}

// Three real memes stacked like evidence on a desk. Hovering fans them out.
export function HeroCollage({ memes }: { memes: PostMeme[] }) {
    const [spread, setSpread] = useState(false);
    const rest = [-7, 5, -2];
    const fanned = [-14, 11, 0];
    const offsets = [
        { x: -30, y: -10 },
        { x: 34, y: 0 },
        { x: 0, y: 30 },
    ];

    return (
        <div className="collage" onPointerEnter={() => setSpread(true)} onPointerLeave={() => setSpread(false)}>
            {memes.slice(0, 3).map((meme, i) => (
                <motion.div
                    key={meme.captionId}
                    className="collage-card"
                    initial={{ opacity: 0, y: 60, rotate: 0 }}
                    animate={{
                        opacity: 1,
                        rotate: spread ? fanned[i] : rest[i],
                        x: spread ? offsets[i].x : 0,
                        y: spread ? offsets[i].y : 0,
                    }}
                    transition={{ type: "spring", stiffness: 140, damping: 16, delay: spread ? 0 : 0.35 + i * 0.12 }}
                    whileHover={{ scale: 1.04, zIndex: 4 }}
                    style={{ zIndex: i + 1 }}
                >
                    <MemeImage url={meme.url} caption={meme.content} format={meme.format} size="small" eager />
                </motion.div>
            ))}
            <span className="collage-label mono">Evidence. Do not touch.</span>
        </div>
    );
}
