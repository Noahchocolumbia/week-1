"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const STEPS = [
    "Uploading evidence",
    "Consulting the algorithm",
    "Lowering intellectual standards",
    "Training one final brain cell",
    "Violating several design principles",
    "Forwarding prompt to the Department of Nonsense",
    "Removing the last trace of nuance",
    "Asking the AI if it's sure",
];

// The generation sequence: a fake system log that advances while the real request runs.
// It never claims to finish on its own; the studio swaps it out when Gemini answers.
export default function Cooking({ styleName, color }: { styleName: string; color: string }) {
    const [step, setStep] = useState(0);
    const [progress, setProgress] = useState(4);

    useEffect(() => {
        const id = setInterval(() => {
            setStep((s) => Math.min(s + 1, STEPS.length - 1));
            // Creeps toward 92% and waits there, like every progress bar ever made.
            setProgress((p) => p + (92 - p) * 0.22);
        }, 1150);
        return () => clearInterval(id);
    }, []);

    const shown = STEPS.slice(Math.max(0, step - 4), step + 1);

    return (
        <div className="cooking" role="status" aria-live="polite">
            <div className="cooking-inner">
                <p className="mono" style={{ color }}>
                    Mode: {styleName}
                </p>
                <h2 className="display wide cooking-headline">Cooking.</h2>
                <div className="cooking-log">
                    <AnimatePresence initial={false}>
                        {shown.map((text, i) => {
                            const isNow = i === shown.length - 1;
                            return (
                                <motion.p
                                    key={text}
                                    className={isNow ? "now" : "done"}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    &gt; {text}
                                    {isNow ? "..." : ""}
                                </motion.p>
                            );
                        })}
                    </AnimatePresence>
                </div>
                <div className="cooking-bar" aria-hidden="true">
                    <motion.div animate={{ width: `${progress}%` }} transition={{ ease: "easeOut", duration: 0.9 }} />
                </div>
                <p className="mono" style={{ marginTop: 10, color: "var(--paper-faint)" }}>
                    Usually 10 to 20 seconds. Gemini is thinking, allegedly.
                </p>
            </div>
        </div>
    );
}
