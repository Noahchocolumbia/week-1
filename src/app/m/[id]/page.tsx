import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "@/components/NavBar";
import PostCard from "@/components/PostCard";
import SiteFooter from "@/components/SiteFooter";
import { loadMeme } from "@/lib/feed";
import { modelName } from "@/lib/format";
import { assess, styleById } from "@/lib/styles";
import { createClient, getUserAndProfile, navProps } from "@/lib/supabase-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Link previews (iMessage, Slack, Discord) show the caption and the photo.
export async function generateMetadata({ params }: PageProps<"/m/[id]">): Promise<Metadata> {
    const { id } = await params;
    if (!UUID.test(id)) return { title: "Laugh or Laugh" };
    const supabase = await createClient();
    const meme = await loadMeme(supabase, id, null);
    if (!meme) return { title: "Laugh or Laugh" };
    return {
        title: `"${meme.content}" · Laugh or Laugh`,
        description: "A machine wrote this caption. Laugh or meh.",
        openGraph: { title: meme.content, images: [{ url: meme.url }] },
    };
}

// Public page for one published meme: the thing "Copy link" points at.
export default async function MemePage({ params }: PageProps<"/m/[id]">) {
    const { id } = await params;
    if (!UUID.test(id)) notFound();

    const { supabase, user, profile } = await getUserAndProfile();
    const meme = await loadMeme(supabase, id, user?.id ?? null);
    if (!meme) notFound();

    const style = styleById(meme.style);

    return (
        <>
            <NavBar signedIn={Boolean(user)} {...navProps(supabase, profile)} />
            <main className="shell" style={{ paddingTop: 40, paddingBottom: 72 }}>
                <div className="share-layout">
                    <PostCard meme={meme} signedIn={Boolean(user)} eager />
                    <div>
                        <p className="mono" style={{ color: "var(--paper-faint)" }}>
                            Case file {meme.captionId.slice(0, 8)}
                        </p>
                        <h1 className="display wide page-title" style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)" }}>
                            Exhibit A
                        </h1>
                        <p className="page-lede">
                            Written by {modelName(meme.model)} in the {style.name} style
                            {meme.edited ? ", then edited by a human who should have known better" : ""}. Posted {meme.ago}{" "}
                            {meme.ago === "just now" ? "" : "ago"}.
                        </p>

                        <div className="assessment" style={{ marginTop: 24, maxWidth: 420 }}>
                            <h3 className="mono">Meme Quality Assurance report</h3>
                            <dl className="mono">
                                {assess(meme.captionId).map((row) => (
                                    <div key={row.label}>
                                        <dt>{row.label}</dt>
                                        <dd>{row.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>

                        <div className="button-row" style={{ justifyContent: "flex-start", marginTop: 28 }}>
                            <Link href={user ? "/rate" : "/top"} className="btn">
                                {user ? "Back to the feed" : "See the Hall of Shame"}
                            </Link>
                            <Link href={user ? "/generate" : "/login"} className="btn btn-primary">
                                Make your own
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
