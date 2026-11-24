import Link from "next/link";
import { redirect } from "next/navigation";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import NavBar from "@/components/NavBar";
import { safeNext } from "@/lib/after-login";
import { getUserAndProfile } from "@/lib/supabase-server";

export const metadata = { title: "Sign in · Laugh or Laugh" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const { user } = await getUserAndProfile();
    const { error, next } = await searchParams;
    const goTo = safeNext(typeof next === "string" ? next : null);
    if (user) redirect(goTo);

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
                            Sign in with any Google account to judge memes and make your own. We only use it to know
                            whose bad jokes are whose.
                        </p>
                        <GoogleSignInButton next={goTo} />
                        {error === "not_allowed" ? (
                            <p className="form-error" role="alert">
                                Access denied: new accounts are limited to approved emails right now. Ask an admin to
                                whitelist your address.
                            </p>
                        ) : (
                            error && (
                                <p className="form-error" role="alert">
                                    Error: sign-in didn&apos;t complete. Try again.
                                </p>
                            )
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
