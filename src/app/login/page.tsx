import { redirect } from "next/navigation";
import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { getUserAndProfile } from "@/lib/supabase-server";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const { user } = await getUserAndProfile();
    if (user) redirect("/rate");

    const { error } = await searchParams;

    return (
        <main className="page-center">
            <div className="retro-card" style={{ maxWidth: "480px", textAlign: "center" }}>
                <span className="retro-badge">[PLAYER 1]</span>
                <h1 className="pixel-heading" style={{ fontSize: "1.25rem", margin: "1.5rem 0 1rem" }}>
                    Sign in
                </h1>
                <p style={{ color: "var(--text-dim)", marginBottom: "2rem", lineHeight: 1.6 }}>
                    Sign in to vote on memes and turn your own photos into AI-captioned ones. Any Google
                    account works, including LionMail.
                </p>
                <GoogleSignInButton />
                {error && (
                    <p className="form-error" style={{ marginTop: "1.5rem" }}>
                        Sign-in didn&apos;t complete. Try again.
                    </p>
                )}
                <p style={{ marginTop: "2rem" }}>
                    <Link href="/top" className="link-button">
                        Just looking? See the top memes &gt;
                    </Link>
                </p>
            </div>
        </main>
    );
}
