import { redirect } from "next/navigation";
import { updateProfile } from "@/app/actions";
import AvatarUploader from "@/components/AvatarUploader";
import NameFields from "@/components/NameFields";
import NavBar from "@/components/NavBar";
import { getUserAndProfile, hasName } from "@/lib/supabase-server";

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (!hasName(profile)) redirect("/welcome");

    const { saved, error } = await searchParams;

    // Your numbers: memes you've posted, votes you've cast, and the score your captions earned.
    const [posted, myVotes, myCaptions, scores] = await Promise.all([
        supabase
            .from("images")
            .select("id", { count: "exact", head: true })
            .eq("profile_id", user.id)
            .eq("published", true),
        supabase.from("caption_votes").select("id", { count: "exact", head: true }),
        supabase.from("captions").select("id").eq("profile_id", user.id),
        supabase.rpc("caption_scores"),
    ]);
    const mine = new Set((myCaptions.data ?? []).map((c: { id: string }) => c.id));
    const earned = ((scores.data ?? []) as { caption_id: string; score: number }[])
        .filter((s) => mine.has(s.caption_id))
        .reduce((total, s) => total + Number(s.score), 0);

    const stats = [
        { label: "Memes posted", value: posted.count ?? 0 },
        { label: "Votes cast", value: myVotes.count ?? 0 },
        { label: "Score earned", value: earned > 0 ? `+${earned}` : earned },
    ];

    const avatarUrl = profile?.avatar_path
        ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
        : null;

    return (
        <>
            <NavBar />
            <main className="content-page">
                <h1 className="pixel-heading page-title">Profile</h1>
                <ul className="stat-row" aria-label="Your stats">
                    {stats.map((stat) => (
                        <li key={stat.label} className="stat-box">
                            <strong>{stat.value}</strong>
                            <span>{stat.label}</span>
                        </li>
                    ))}
                </ul>
                <div className="retro-card">
                    <AvatarUploader userId={user.id} avatarUrl={avatarUrl} />
                    <form action={updateProfile}>
                        <NameFields firstName={profile?.first_name} lastName={profile?.last_name} />
                        <label className="retro-label" htmlFor="email">
                            Email
                        </label>
                        <input className="retro-input" id="email" value={user.email ?? ""} readOnly disabled />
                        {saved && <p className="form-success">Saved.</p>}
                        {error && <p className="form-error">Enter both a first and last name.</p>}
                        <button type="submit" className="retro-button" style={{ marginTop: "1.5rem" }}>
                            Save <span className="arrow">&gt;</span>
                        </button>
                    </form>
                </div>
            </main>
        </>
    );
}
