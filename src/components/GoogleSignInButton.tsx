"use client";

import { useState } from "react";
import Magnetic from "@/components/Magnetic";
import { createClient } from "@/lib/supabase";

export default function GoogleSignInButton() {
    const [going, setGoing] = useState(false);
    const [error, setError] = useState("");

    async function signIn() {
        setGoing(true);
        setError("");
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
