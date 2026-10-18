import { redirect } from "next/navigation";
import { completeWelcome } from "@/app/actions";
import NameFields from "@/components/NameFields";
import { getUserAndProfile, hasName } from "@/lib/supabase-server";

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
    const { user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (hasName(profile)) redirect("/rate");

    const { error } = await searchParams;

    return (
        <main className="page-center">
            <form action={completeWelcome} className="retro-card" style={{ width: "100%", maxWidth: "480px" }}>
                <span className="retro-badge">[NEW USER]</span>
                <h1 className="pixel-heading" style={{ fontSize: "1.1rem", margin: "1.5rem 0 1rem" }}>
                    One more step
                </h1>
                <p style={{ color: "var(--text-dim)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                    Add your name to finish setting up your account.
                </p>
                <NameFields firstName={profile?.first_name} lastName={profile?.last_name} />
                {error && <p className="form-error">Enter both a first and last name.</p>}
                <button type="submit" className="retro-button" style={{ marginTop: "1.5rem" }}>
                    Continue <span className="arrow">&gt;</span>
                </button>
            </form>
        </main>
    );
}
