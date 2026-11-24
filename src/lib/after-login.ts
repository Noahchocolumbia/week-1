// Where to send someone once they've signed in. The login page saves the page they were
// trying to reach in a short-lived cookie (Google's round trip can't carry it reliably),
// and the auth callback and welcome form read it back. Defaults to the homepage.
export const AFTER_LOGIN_COOKIE = "after_login";

// Only same-site paths, never "//evil.com" or the login pages themselves.
export function safeNext(value: string | null | undefined): string {
    const path = (value ?? "").trim();
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
    if (path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/welcome")) return "/";
    return path;
}
