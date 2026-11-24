"use client";

import { useState } from "react";
import Magnetic from "@/components/Magnetic";
import { AFTER_LOGIN_COOKIE } from "@/lib/after-login";
import { createClient } from "@/lib/supabase";

export default function GoogleSignInButton({ next = "/" }: { next?: string }) {
    const [going, setGoing] = useState(false);
    const [error, setError] = useState("");

    async function signIn() {
        setGoing(true);
        setError("");
        // Remember where to land after Google sends them back (read in /auth/callback).
        document.cookie = `${AFTER_LOGIN_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
        const supabase = createClient();
        try {
            // On success this redirects away, so `going` stays true until navigation.
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
            if (error) throw error;
        } catch {
            // Init failed (offline, misconfigured provider): re-enable so they can retry.
            setGoing(false);
            setError("Couldn't reach Google. Check your connection and try again.");
        }
    }

    return (
        <>
            <Magnetic strength={0.1}>
                <button type="button" className="btn btn-primary btn-big" onClick={signIn} disabled={going} style={{ width: "100%" }}>
                    {going ? "Redirecting to Google..." : "Continue with Google →"}
                </button>
            </Magnetic>
            {error && (
                <p className="form-error" role="alert">
                    {error}
                </p>
            )}
        </>
    );
}
