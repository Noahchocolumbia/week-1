"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

// Wraps a button or link so it leans a little toward the cursor, then springs back.
export default function Magnetic({ children, strength = 0.25 }: { children: React.ReactNode; strength?: number }) {
    const reduce = useReducedMotion();
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
    const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });

    function onMove(event: React.PointerEvent<HTMLDivElement>) {
        if (reduce || event.pointerType !== "mouse") return;
        const rect = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - rect.left - rect.width / 2) * strength);
        y.set((event.clientY - rect.top - rect.height / 2) * strength);
    }

    function onLeave() {
        x.set(0);
        y.set(0);
    }

    return (
        <motion.div className="magnetic" style={{ x: sx, y: sy }} onPointerMove={onMove} onPointerLeave={onLeave}>
            {children}
        </motion.div>
    );
}
