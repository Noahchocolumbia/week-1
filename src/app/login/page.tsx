import Link from "next/link";
import { redirect } from "next/navigation";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import NavBar from "@/components/NavBar";
import { getUserAndProfile } from "@/lib/supabase-server";

export const metadata = { title: "Sign in · Laugh or Laugh" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const { user } = await getUserAndProfile();
    if (user) redirect("/rate");

    const { error } = await searchParams;

    return (
        <>
            <NavBar signedIn={false} />
            <main className="checkpoint">
                <div className="checkpoint-card">
                    <div className="studio-bar mono">
                        <span className="lights" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                        </span>
                        <span>Security checkpoint</span>
                    </div>
                    <div className="checkpoint-body">
                        <h1 className="display wide">Identify yourself.</h1>
                        <p>
                            Sign in to judge memes and make your own. Any Google account works, including LionMail. We
                            only use it to know whose bad jokes are whose.
                        </p>
                        <GoogleSignInButton />
                        {error && (
                            <p className="form-error" role="alert">
                                Error: sign-in didn&apos;t complete. Try again.
                            </p>
                        )}
                        <p className="mono" style={{ marginTop: 24, marginBottom: 0 }}>
                            Just browsing?{" "}
                            <Link href="/top" className="link">
                                Tour the Hall of Shame
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </>
    );
}
