// Humor styles and meme layouts. Shared by the studio (what people pick)
// and the server (what Gemini is told to write).

export type HumorStyle = {
    id: string;
    name: string;
    // One dry line shown when the style is picked.
    blurb: string;
    // Added to the Gemini prompt.
    instruction: string;
    // Highlight color for this style's chip and labels.
    color: string;
    // 0-100, purely for the chaos meter.
    chaos: number;
};

export const HUMOR_STYLES: HumorStyle[] = [
    {
        id: "classic",
        name: "Classic",
        blurb: "Regulation-grade humor. Approved by nobody.",
        instruction: "Write in a classic, broadly relatable meme voice.",
        color: "#ffe600",
        chaos: 20,
    },
    {
        id: "terminally-online",
        name: "Terminally Online",
        blurb: "Has not touched grass since the last software update.",
        instruction:
            "Write like someone who is extremely online: current internet slang, irony, lowercase energy, references to group chats and timelines.",
        color: "#3df2ff",
        chaos: 70,
    },
    {
        id: "corporate-brainrot",
        name: "Corporate Brainrot",
        blurb: "Per my last meme, let's circle back on this joke.",
        instruction:
            "Write like a LinkedIn post or office email applied to this photo: synergy, circling back, KPIs, deliverables, delivered with total sincerity.",
        color: "#9cff57",
        chaos: 45,
    },
    {
        id: "unhinged",
        name: "Unhinged",
        blurb: "Our lawyers asked us to stop offering this one.",
        instruction:
            "Write unhinged, chaotic captions with escalating absurd logic. Keep it funny, never cruel, hateful or sexual.",
        color: "#ff3b30",
        chaos: 95,
    },
    {
        id: "surrealist",
        name: "Surrealist",
        blurb: "The pipe is not a pipe. The meme is not a meme.",
        instruction: "Write dreamlike, surreal captions with strange but vivid logic, like a joke told in a dream.",
        color: "#b98cff",
        chaos: 80,
    },
    {
        id: "2016-internet",
        name: "2016 Internet",
        blurb: "Humanity peaked here. We are simply visiting.",
        instruction:
            "Write in 2016 meme style: 'me:', 'nobody:', 'when you...', Harambe-era energy, but don't reference real tragedies.",
        color: "#ff9f1c",
        chaos: 55,
    },
    {
        id: "deep-fried",
        name: "Deep Fried",
        blurb: "Saturation: illegal. Contrast: also illegal.",
        instruction:
            "Write loud, deep-fried meme captions: all caps energy, absurd emphasis, a 🅱️ or 💯 is allowed but don't overdo it.",
        color: "#ff5fd2",
        chaos: 90,
    },
    {
        id: "academic-nonsense",
        name: "Academic Nonsense",
        blurb: "Peer reviewed by two raccoons and a TA.",
        instruction:
            "Write like a pompous academic paper, thesis abstract or seminar remark about this photo, with fake rigor.",
        color: "#f1ede4",
        chaos: 35,
    },
    {
        id: "boomer-facebook",
        name: "Boomer Facebook",
        blurb: "Shared 41 times by your aunt. Minion not included.",
        instruction:
            "Write like a boomer Facebook post: wholesome confusion, random capitalization, 'LOL' meaning lots of love, signed off oddly.",
        color: "#57b8ff",
        chaos: 60,
    },
];

export function styleById(id: string | null | undefined) {
    return HUMOR_STYLES.find((s) => s.id === id) ?? HUMOR_STYLES[0];
}

export type MemeFormat = "top" | "overlay" | "bottom";

export const MEME_FORMATS: { id: MemeFormat; name: string; hint: string }[] = [
    { id: "top", name: "Headline", hint: "Caption bar above the photo" },
    { id: "overlay", name: "Impact", hint: "Classic text right on the photo" },
    { id: "bottom", name: "Subtitle", hint: "Caption bar under the photo" },
];

export function isFormat(value: unknown): value is MemeFormat {
    return value === "top" || value === "overlay" || value === "bottom";
}

// A fake, deterministic "quality assessment" so each meme always gets the same verdict.
const VERDICTS = {
    comedic: ["DEBATABLE", "LEGALLY FUNNY", "PENDING REVIEW", "ONE (1) CHUCKLE", "STRONG NOSE EXHALE", "WEAPONS-GRADE"],
    damage: ["MILD", "MODERATE", "SEVERE", "IRREVERSIBLE", "CONTAINED", "SPREADING"],
    originality: ["UNDER INVESTIGATION", "SUSPICIOUSLY HIGH", "BORROWED", "CERTIFIED MID", "UNPRECEDENTED", "INCONCLUSIVE"],
};

function hash(text: string) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return Math.abs(h);
}

export function assess(seed: string) {
    const h = hash(seed);
    return [
        { label: "Comedic value", value: VERDICTS.comedic[h % 6] },
        { label: "Internet damage", value: VERDICTS.damage[(h >> 3) % 6] },
        { label: "Originality", value: VERDICTS.originality[(h >> 6) % 6] },
    ];
}

// Dry replies for prompts that are suspicious, empty, or homework.
export function promptQuip(prompt: string): string | null {
    const p = prompt.toLowerCase();
    if (!p.trim()) return null;
    if (/(homework|essay|exam|midterm|final|problem set|pset)/.test(p))
        return "We cannot do your homework. We can make it funnier though.";
    if (/(tax|irs|w-?2)/.test(p)) return "Your prompt has been forwarded to the Department of Nonsense, Tax Division.";
    if (/(ex|situationship|crush)\b/.test(p)) return "Emotional damage detected. Proceeding anyway.";
    if (/(mta|subway|train)/.test(p)) return "Delays expected. Captions running local.";
    if (p.length > 160) return "That's a lot of lore. The AI will skim it like a syllabus.";
    return null;
}
