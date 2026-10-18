// "just now", "5m", "3h", "2d", "Oct 4": the short times social feeds use.
export function timeAgo(iso: string, now = Date.now()) {
    const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Laughs and mehs from the net score and the vote count (score = laughs - mehs).
export function splitVotes(score: number, votes: number) {
    return { laughs: (votes + score) / 2, mehs: (votes - score) / 2 };
}

// "gemini-3.8-flash" -> "Gemini 3.8 Flash"
export function modelName(model: string) {
    return model
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
