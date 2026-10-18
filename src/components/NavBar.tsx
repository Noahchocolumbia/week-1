"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SIGNED_IN = [
    { href: "/", label: "Home" },
    { href: "/rate", label: "Rate" },
    { href: "/generate", label: "Make a meme" },
    { href: "/top", label: "Top memes" },
    { href: "/profile", label: "Profile" },
];

const SIGNED_OUT = [
    { href: "/", label: "Home" },
    { href: "/top", label: "Top memes" },
];

// Shown at the top of every page except the home page.
export default function NavBar({ signedIn = true }: { signedIn?: boolean }) {
    const pathname = usePathname();
    const links = signedIn ? SIGNED_IN : SIGNED_OUT;

    return (
        <nav className="retro-nav" aria-label="Main">
            {links.map((link) => (
                <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
                    {link.label}
                </Link>
            ))}
            {signedIn ? (
                <form action="/auth/signout" method="post" className="nav-end">
                    <button type="submit">Sign out</button>
                </form>
            ) : (
                <Link href="/login" className="nav-end nav-cta">
                    Sign in
                </Link>
            )}
        </nav>
    );
}
