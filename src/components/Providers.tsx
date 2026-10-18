"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Ctx = {
    // Shows a short system message at the bottom of the screen.
    toast: (message: string) => void;
    chaos: boolean;
    toggleChaos: () => void;
};

const AppContext = createContext<Ctx>({ toast: () => {}, chaos: false, toggleChaos: () => {} });

export function useApp() {
    return useContext(AppContext);
}

export default function Providers({ children }: { children: React.ReactNode }) {
    const [message, setMessage] = useState<string | null>(null);
    // Chaos mode (the logo easter egg) survives page changes in this tab.
    const [chaos, setChaos] = useState(() => {
        if (typeof window === "undefined") return false;
        try {
            return sessionStorage.getItem("chaos") === "on";
        } catch {
            // Storage can be unavailable; chaos simply resets.
            return false;
        }
    });
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const toast = useCallback((text: string) => {
        setMessage(text);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setMessage(null), 3200);
    }, []);

    useEffect(() => {
        document.documentElement.dataset.chaos = chaos ? "on" : "off";
        try {
            sessionStorage.setItem("chaos", chaos ? "on" : "off");
        } catch {}
    }, [chaos]);

    const toggleChaos = useCallback(() => {
        toast(chaos ? "Chaos mode disengaged. Order has been restored, allegedly." : "Chaos mode engaged. Every meme is now deep fried.");
        setChaos(!chaos);
    }, [chaos, toast]);

    return (
        // Anyone who asks their device for less motion gets it here too.
        <MotionConfig reducedMotion="user">
            <AppContext.Provider value={{ toast, chaos, toggleChaos }}>
                {children}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            key={message}
                            className="toast"
                            role="status"
                            initial={{ opacity: 0, y: 24, x: "-50%" }}
                            animate={{ opacity: 1, y: 0, x: "-50%" }}
                            exit={{ opacity: 0, y: 12, x: "-50%" }}
                            transition={{ type: "spring", stiffness: 420, damping: 30 }}
                        >
                            {message}
                        </motion.div>
                    )}
                </AnimatePresence>
            </AppContext.Provider>
        </MotionConfig>
    );
}
