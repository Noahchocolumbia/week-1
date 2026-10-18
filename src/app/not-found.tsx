import Link from "next/link";

// Shown for any page or meme that doesn't exist (or was deleted out of shame).
export default function NotFound() {
    return (
        <main className="checkpoint">
            <div className="checkpoint-card">
                <div className="studio-bar mono">
                    <span className="lights" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                    </span>
                    <span>Error 404</span>
                </div>
                <div className="checkpoint-body">
                    <h1 className="display wide">Not found.</h1>
                    <p>
                        This meme doesn&apos;t exist, was deleted, or never recovered from its own reviews. The
                        Department of Nonsense regrets nothing.
                    </p>
                    <Link href="/" className="btn btn-primary btn-big">
                        Back to safety →
                    </Link>
                </div>
            </div>
        </main>
    );
}
