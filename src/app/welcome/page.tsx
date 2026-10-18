import { redirect } from "next/navigation";
import { completeWelcome } from "@/app/actions";
import NameFields from "@/components/NameFields";
import NavBar from "@/components/NavBar";
import { getUserAndProfile, hasName, navProps } from "@/lib/supabase-server";

export const metadata = { title: "Welcome · Laugh or Laugh" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
    const { supabase, user, profile } = await getUserAndProfile();
    if (!user) redirect("/login");
    if (hasName(profile)) redirect("/rate");

    const { error } = await searchParams;

    return (
        <>
            <NavBar {...navProps(supabase, profile)} />
            <main className="checkpoint">
                <form action={completeWelcome} className="checkpoint-card">
                    <div className="studio-bar mono">
                        <span className="lights" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                        </span>
                        <span>Intake form 1 of 1</span>
                    </div>
                    <div className="checkpoint-body">
                        <h1 className="display wide">One more thing.</h1>
                        <p>The Department of Nonsense requires a name for its records. Your real one, ideally.</p>
                        <NameFields firstName={profile?.first_name} lastName={profile?.last_name} />
                        {error && (
                            <p className="form-error" role="alert">
                                Error: enter both a first and last name.
                            </p>
                        )}
                        <button type="submit" className="btn btn-primary btn-big" style={{ marginTop: 24 }}>
                            Enter the feed →
                        </button>
                    </div>
                </form>
            </main>
        </>
    );
}
