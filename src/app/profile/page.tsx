import { redirect } from "next/navigation";
import { updateProfile } from "@/app/actions";
import AvatarUploader from "@/components/AvatarUploader";
import NameFields from "@/components/NameFields";
import NavBar from "@/components/NavBar";
import { loadScores } from "@/lib/feed";
import { getUserAndProfile, hasName, navProps } from "@/lib/supabase-server";

export const metadata = { title: "Personnel file · Laugh or Laugh" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (!hasName(profile)) redirect("/welcome");

    const { saved, error } = await searchParams;

    // Your numbers: memes you've posted, votes you've cast, and the score your captions earned.
    const [posted, myVotes, myCaptions, scoreOf] = await Promise.all([
        supabase
            .from("images")
            .select("id", { count: "exact", head: true })
            .eq("profile_id", user.id)
            .eq("published", true),
        supabase.from("caption_votes").select("id", { count: "exact", head: true }),
        supabase.from("captions").select("id").eq("profile_id", user.id),
        loadScores(supabase),
    ]);
    const mine = (myCaptions.data ?? []).map((c: { id: string }) => c.id);
    const earned = mine.reduce((total, id) => total + (scoreOf.get(id)?.score ?? 0), 0);

    const stats = [
        { label: "Memes posted", value: posted.count ?? 0 },
        { label: "Verdicts cast", value: myVotes.count ?? 0 },
        { label: "Score earned", value: earned > 0 ? `+${earned}` : earned },
    ];

    const nav = navProps(supabase, profile);
    const name = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();

    return (
        <>
            <NavBar {...nav} />
            <main className="shell" style={{ paddingBottom: 96 }}>
                <div className="page-top">
                    <p className="mono" style={{ color: "var(--paper-faint)" }}>
                        Personnel file / clearance level: meme
                    </p>
                </div>
                <div className="dossier">
                    <div className="dossier-photo">
                        <AvatarUploader userId={user.id} avatarUrl={nav.avatarUrl} initial={nav.initial} />
                    </div>
                    <div className="dossier-info">
                        <h1 className="display wide dossier-name">{name}</h1>
                        <p className="mono" style={{ color: "var(--paper-faint)", marginTop: 10 }}>
                            {user.email}
                        </p>
                        <div className="dossier-stats">
                            {stats.map((stat) => (
                                <div key={stat.label}>
                                    <strong>{stat.value}</strong>
                                    <span className="mono">{stat.label}</span>
                                </div>
                            ))}
                        </div>

                        <form action={updateProfile} className="dossier-form">
                            <p className="mono" style={{ color: "var(--paper-faint)", marginTop: 16 }}>
                                Amend your records
                            </p>
                            <NameFields firstName={profile?.first_name} lastName={profile?.last_name} />
                            {saved && <p className="form-success">Records updated. The Department thanks you.</p>}
                            {error && (
                                <p className="form-error" role="alert">
                                    Error: enter both a first and last name.
                                </p>
                            )}
                            <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }}>
                                Save changes
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </>
    );
}
