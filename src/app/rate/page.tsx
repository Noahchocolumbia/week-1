import Link from "next/link";
import { redirect } from "next/navigation";
import MemeFeed from "@/components/MemeFeed";
import NavBar from "@/components/NavBar";
import { loadMemes } from "@/lib/feed";
import { getUserAndProfile, hasName, navProps } from "@/lib/supabase-server";

export const metadata = { title: "Feed · Laugh or Laugh" };

// Gated route: only signed-in users can rate memes.
export default async function RatePage() {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (!hasName(profile)) redirect("/welcome");

    const { error, memes } = await loadMemes(supabase, user.id);

    // Memes you haven't rated come first, so a return visit starts with something new.
    const ordered = [...memes.filter((m) => m.myVote === 0), ...memes.filter((m) => m.myVote !== 0)];

    return (
        <>
            <NavBar {...navProps(supabase, profile)} />
            <main className="shell">
                <div className="page-top">
                    <p className="mono" style={{ color: "var(--paper-faint)" }}>
                        Court is in session
                    </p>
                    <h1 className="display wide page-title">The feed</h1>
                    <p className="page-lede">
                        Every caption below was written by a machine. Laugh if it got you. Meh if it didn&apos;t. The
                        algorithm takes it personally either way.
                    </p>
                </div>

                {error ? (
                    <div className="empty">
                        <h2 className="display">Feed offline.</h2>
                        <p>The memes didn&apos;t load. Refresh the page and try again.</p>
                    </div>
                ) : ordered.length === 0 ? (
                    <div className="empty">
                        <h2 className="display">Nothing here.</h2>
                        <p>The feed is empty. Somebody has to go first. It might as well be you.</p>
                        <Link href="/generate" className="btn btn-primary">
                            Make the first meme
                        </Link>
                    </div>
                ) : (
                    <MemeFeed memes={ordered} />
                )}
            </main>
        </>
    );
}
