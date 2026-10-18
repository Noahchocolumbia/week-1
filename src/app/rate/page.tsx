import { Anton } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";
import MemeFeed from "@/components/MemeFeed";
import NavBar from "@/components/NavBar";
import { loadMemes } from "@/lib/feed";
import { getUserAndProfile, hasName } from "@/lib/supabase-server";

// The heavy, condensed typeface classic memes use.
const memeFont = Anton({ weight: "400", subsets: ["latin"] });

// Gated route: only signed-in users can rate captions.
export default async function RatePage() {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (!hasName(profile)) redirect("/welcome");

    const { error, memes } = await loadMemes(supabase, user.id);

    // Memes you haven't rated come first, so a return visit starts with something new.
    const ordered = [...memes.filter((m) => m.myVote === 0), ...memes.filter((m) => m.myVote !== 0)];

    return (
        <div className="meme-page">
            <NavBar />
            {error ? (
                <main className="page-center">
                    <p>Something went wrong loading memes. Refresh to try again.</p>
                </main>
            ) : ordered.length === 0 ? (
                <main className="page-center">
                    <div className="retro-card" style={{ textAlign: "center" }}>
                        <p style={{ color: "var(--text-dim)", marginBottom: "1.5rem" }}>
                            Nothing to rate yet. Be the first to post a meme.
                        </p>
                        <Link href="/generate" className="retro-button">
                            Make a meme <span className="arrow">&gt;</span>
                        </Link>
                    </div>
                </main>
            ) : (
                <MemeFeed memes={ordered} captionFont={memeFont.className} />
            )}
        </div>
    );
}
