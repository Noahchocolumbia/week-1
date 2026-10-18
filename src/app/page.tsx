import Link from "next/link";
import { HeroCollage, HeroHeadline, HeroPrompt } from "@/components/Hero";
import NavBar from "@/components/NavBar";
import PostCard from "@/components/PostCard";
import SiteFooter from "@/components/SiteFooter";
import { loadMemes, topMemes } from "@/lib/feed";
import { modelName } from "@/lib/format";
import { getUserAndProfile, navProps } from "@/lib/supabase-server";

const BAND = [
    "Advanced technology. Questionable outcomes",
    "Generate something deeply unnecessary",
    "Certified internet garbage",
    "Professionally engineered stupidity",
    "Your creativity has been outsourced",
];

const PROCESS = [
    { title: "Submit evidence", text: "Upload a photo. Your camera roll is full of crimes waiting to happen." },
    { title: "Pick a humor style", text: "Nine flavors, from Corporate Brainrot to Boomer Facebook. Choose your weapon." },
    { title: "The machine cooks", text: "Gemini writes three captions. You edit, remix, or regenerate until it's legally funny." },
    { title: "Public judgment", text: "Post it. Strangers laugh or meh. The Hall of Shame keeps score forever." },
];

export default async function Home() {
    const { supabase, user, profile } = await getUserAndProfile();
    const { memes } = await loadMemes(supabase, user?.id ?? null);
    const featured = topMemes(memes, 3);
    // Newest first for the gallery, one caption per photo so it doesn't repeat itself.
    const seen = new Set<string>();
    const recent = [...memes]
        .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
        .filter((m) => (seen.has(m.imageId) ? false : (seen.add(m.imageId), true)))
        .slice(0, 9);
    const latestModel = memes[0]?.model;

    return (
        <>
            <NavBar signedIn={Boolean(user)} {...navProps(supabase, profile)} />
            <main>
                <section className="shell hero">
                    <div>
                        <div className="hero-kicker mono">
                            <span>Dept. of Nonsense / NYC</span>
                            <span>
                                {user && profile?.first_name ? `Welcome back, ${profile.first_name}` : "Est. 2026"}
                            </span>
                        </div>
                        <HeroHeadline />
                        <p className="hero-sub">
                            State-of-the-art artificial intelligence dedicated to the advancement of absolute nonsense.
                        </p>
                        <HeroPrompt signedIn={Boolean(user)} />
                        <div className="status-row mono" aria-label="System status">
                            <span>
                                <i className="dot" aria-hidden="true" /> AI online
                            </span>
                            <span>
                                <i className="dot dot-cyan" aria-hidden="true" />{" "}
                                {latestModel ? modelName(latestModel) : "Gemini"}
                            </span>
                            <span>
                                <i className="dot dot-red" aria-hidden="true" /> {memes.length} memes in circulation
                            </span>
                        </div>
                    </div>
                    {featured.length > 0 && <HeroCollage memes={featured} />}
                </section>

                <div className="band" aria-hidden="true">
                    <div className="band-track">
                        {[...BAND, ...BAND].map((text, i) => (
                            <span key={i}>{text}</span>
                        ))}
                    </div>
                </div>

                {recent.length > 0 && (
                    <section className="section">
                        <div className="shell">
                            <div className="section-head">
                                <h2 className="display wide section-title">
                                    Recent crimes
                                    <br />
                                    against comedy
                                </h2>
                                <p className="section-note">
                                    A curated exhibition of questionable internet history. Every caption machine-written.{" "}
                                    <Link href="/top" className="link">
                                        See the Hall of Shame
                                    </Link>
                                </p>
                            </div>
                            <div className="gallery">
                                {recent.map((meme, i) => (
                                    <PostCard key={meme.captionId} meme={meme} signedIn={Boolean(user)} variant="exhibit" exhibit={i + 1} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                <section className="section">
                    <div className="shell">
                        <div className="section-head">
                            <h2 className="display wide section-title">How the sausage is made</h2>
                            <p className="section-note">Four steps. Zero oversight.</p>
                        </div>
                        <ol className="process">
                            {PROCESS.map((step, i) => (
                                <li key={step.title}>
                                    <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
                                    <h3>{step.title}</h3>
                                    <p>{step.text}</p>
                                </li>
                            ))}
                        </ol>
                        <div className="button-row" style={{ justifyContent: "flex-start", marginTop: 32 }}>
                            <Link href={user ? "/generate" : "/login"} className="btn btn-primary btn-big">
                                {user ? "Open the studio →" : "Sign in to start →"}
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </>
    );
}
