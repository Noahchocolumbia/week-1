"use client";

import { useState } from "react";
import Magnetic from "@/components/Magnetic";
import { createClient } from "@/lib/supabase";

export default function GoogleSignInButton() {
    const [going, setGoing] = useState(false);

    async function signIn() {
        setGoing(true);
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
    }

    return (
        <Magnetic strength={0.1}>
            <button type="button" className="btn btn-primary btn-big" onClick={signIn} disabled={going} style={{ width: "100%" }}>
                {going ? "Redirecting to Google..." : "Continue with Google →"}
            </button>
        </Magnetic>
    );
}
