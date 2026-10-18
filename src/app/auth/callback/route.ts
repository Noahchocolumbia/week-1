import { NextResponse } from "next/server";
import { createClient, hasName, type Profile } from "@/lib/supabase-server";

// Google -> Supabase -> here, with a one-time ?code= in the URL.
// We swap that code for a session (stored in cookies), then send the user on.
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");

    // On Vercel the public hostname arrives in this header.
    const forwardedHost = request.headers.get("x-forwarded-host");
    const base =
        process.env.NODE_ENV !== "development" && forwardedHost ? `https://${forwardedHost}` : origin;

    if (!code) return NextResponse.redirect(`${base}/login?error=1`);

    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return NextResponse.redirect(`${base}/login?error=1`);

    const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_path")
        .eq("id", data.user.id)
        .maybeSingle<Profile>();

    // First-time users have no name yet, so ask for it.
    return NextResponse.redirect(`${base}${hasName(profile) ? "/rate" : "/welcome"}`);
}
