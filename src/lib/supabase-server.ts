import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server client: used in Server Components, Server Actions and Route Handlers.
// The session lives in cookies, so the client is told how to read and write them.
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server Components can't write cookies. That's fine:
                        // src/proxy.ts refreshes the session on every request.
                    }
                },
            },
        }
    );
}

export type Profile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_path: string | null;
};

// Returns the logged-in user and their profiles row (both null when logged out).
export async function getUserAndProfile() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { supabase, user: null, profile: null };

    const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_path")
        .eq("id", user.id)
        .maybeSingle<Profile>();

    return { supabase, user, profile };
}

export function hasName(profile: Profile | null) {
    return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

// What the top bar needs: the profile photo URL and a letter to show when there isn't one.
export function navProps(supabase: Awaited<ReturnType<typeof createClient>>, profile: Profile | null) {
    return {
        avatarUrl: profile?.avatar_path
            ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
            : null,
        initial: profile?.first_name?.trim().charAt(0).toUpperCase() || "?",
    };
}
