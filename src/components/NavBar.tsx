"use client";

import { Flame, Home, LogIn, Plus, Trophy, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { useApp } from "@/components/Providers";

type Props = {
    signedIn?: boolean;
    // Shown in the top-right corner; falls back to the first letter of the name.
    avatarUrl?: string | null;
    initial?: string;
};

const TICKER = [
    { text: "Brain cells remaining: 2" },
    { text: "ISO 42069 certified" },
    { text: "Advanced technology. Questionable outcomes." },
    { text: "Meme Quality Assurance Department: on lunch", red: true },
    { text: "Your creativity has been outsourced" },
    { text: "Humanity peaked somewhere around 2016" },
    { text: "Captions by Gemini. Judgment by you." },
    { text: "Built for absolutely no reason", red: true },
];

// Status ticker, wordmark, nav, and a tab bar along the bottom on phones.
export default function NavBar({ signedIn = true, avatarUrl = null, initial = "?" }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const { toggleChaos } = useApp();
    const here = (href: string) => (pathname === href ? "page" : undefined);

    // Easter egg: click the wordmark five times quickly to toggle chaos mode.
    const clicks = useRef<number[]>([]);
    function onWordmark() {
        const now = Date.now();
        clicks.current = [...clicks.current.filter((t) => now - t < 1800), now];
        if (clicks.current.length >= 5) {
            clicks.current = [];
            toggleChaos();
            return;
        }
        if (clicks.current.length === 1) {
            // A single click still goes home, after a short beat to catch repeats.
            setTimeout(() => {
                if (clicks.current.length === 1 && pathname !== "/") router.push("/");
            }, 260);
        }
    }

    const links = signedIn
        ? [
              { href: "/rate", label: "Feed" },
              { href: "/generate", label: "Studio" },
              { href: "/top", label: "Hall of Shame" },
          ]
        : [
              { href: "/", label: "Home" },
              { href: "/top", label: "Hall of Shame" },
          ];

    const ticker = [...TICKER, ...TICKER];

    return (
        <>
            <div className="ticker mono" aria-hidden="true">
                <div className="ticker-track">
                    {ticker.map((item, i) => (
                        <span key={i} className={item.red ? "is-red" : undefined}>
                            {item.text}
                        </span>
                    ))}
                </div>
            </div>

            <header className="site-header">
                <div className="shell header-inner">
                    <button type="button" className="wordmark" onClick={onWordmark} aria-label="Laugh or Laugh, home">
                        LAUGH<span className="or">OR</span>LAUGH<sup>®</sup>
                    </button>

                    <nav className="main-nav" aria-label="Main">
                        {links.map((link) => (
                            <Link key={link.href} href={link.href} aria-current={here(link.href)}>
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="header-actions">
                        {signedIn ? (
                            <>
                                <Link href="/generate" className="btn btn-primary btn-create" title="Warning: may produce content">
                                    <Plus size={16} aria-hidden="true" /> New meme
                                </Link>
                                <form action="/auth/signout" method="post">
                                    <button type="submit" className="signout" title="Touch grass">
                                        Log out
                                    </button>
                                </form>
                                <Link href="/profile" className="avatar-link" aria-label="Your profile" aria-current={here("/profile")}>
                                    {avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={avatarUrl} alt="" />
                                    ) : (
                                        <span className="avatar-fallback">{initial}</span>
                                    )}
                                </Link>
                            </>
                        ) : (
                            <Link href="/login" className="btn btn-primary btn-small">
                                Sign in
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <nav className="tabbar" aria-label="Main">
                <Link href="/" aria-current={here("/")}>
                    <Home size={20} aria-hidden="true" />
                    Home
                </Link>
                {signedIn ? (
                    <>
                        <Link href="/rate" aria-current={here("/rate")}>
                            <Flame size={20} aria-hidden="true" />
                            Feed
                        </Link>
                        <Link href="/generate" className="tab-create" aria-current={here("/generate")}>
                            <Plus size={22} aria-hidden="true" />
                            Studio
                        </Link>
                        <Link href="/top" aria-current={here("/top")}>
                            <Trophy size={20} aria-hidden="true" />
                            Shame
                        </Link>
                        <Link href="/profile" aria-current={here("/profile")}>
                            <User size={20} aria-hidden="true" />
                            You
                        </Link>
                    </>
                ) : (
                    <>
                        <Link href="/top" aria-current={here("/top")}>
                            <Trophy size={20} aria-hidden="true" />
                            Shame
                        </Link>
                        <Link href="/login" aria-current={here("/login")}>
                            <LogIn size={20} aria-hidden="true" />
                            Sign in
                        </Link>
                    </>
                )}
            </nav>
        </>
    );
}
