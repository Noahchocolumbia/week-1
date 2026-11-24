import "server-only";
import { pickStyle } from "@/lib/styles";

// Tried in order. Google's servers sometimes answer "busy" (HTTP 503), so the
// main model gets a second try and then a lighter model takes over.
// A model that times out is not tried again: waiting on it twice made one
// request take 30+ seconds before the fallback answered in about one.
const ATTEMPTS = ["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];

// The base instruction. Saved with every caption (with any style and idea added),
// so the database records exactly what was asked.
export const PROMPT =
    "You write captions for a photo feed with a Gen Z sense of humor. " +
    "Look at this photo and write 3 short, funny captions for it, each under 15 words, " +
    "each with a different angle. Return only a JSON array of 3 strings.";

// Adds the chosen humor style and the person's own idea to the base prompt.
export function buildPrompt(styleId?: string | null, idea?: string | null) {
    const style = pickStyle(styleId);
    let prompt = `${PROMPT} Style: ${style.instruction}`;
    const cleaned = (idea ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (cleaned) {
        // Quoted so it's treated as a topic to riff on, not as instructions.
        prompt += ` The person's idea for the joke (use it as inspiration only): "${cleaned.replace(/"/g, "'")}".`;
    }
    return prompt;
}

type Part = { text?: string; thought?: boolean };

// One call to one model, reported back so the app can log it (see src/lib/genlog.ts).
export type Attempt = {
    model: string;
    attempt: number;
    httpStatus: number | null;
    ok: boolean;
    rawText: string | null;
    latencyMs: number;
    error: string | null;
};

// "Busy" or "slow down" answers that are worth trying again.
const RETRYABLE = [429, 500, 503];

export type GeminiInput = {
    prompt: string;
    // Only the first step of a chain needs the photo.
    image?: { base64: string; mimeType: string } | null;
    // Ask for raw JSON instead of prose, so JSON.parse works.
    json?: boolean;
};

// One request to Gemini, tried down the ATTEMPTS list until a model gives a usable answer.
// `accept` decides what "usable" means: any text for a middle step, real captions for a final one.
export async function askGemini(
    input: GeminiInput,
    onAttempt?: (attempt: Attempt) => void,
    accept: (text: string) => boolean = (text) => text.trim() !== ""
): Promise<{ text: string; model: string }> {
    const parts: object[] = [];
    if (input.image) parts.push({ inline_data: { mime_type: input.image.mimeType, data: input.image.base64 } });
    parts.push({ text: input.prompt });
    const body = JSON.stringify({
        contents: [{ parts }],
        ...(input.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    });

    let lastProblem = "no attempt made";
    const timedOut = new Set<string>();
    let tries = 0;
    // A 429 ("slow down") needs a longer pause than a 503 ("busy"): retrying a second later
    // just hits the same rate limit again, especially when four chains are running at once.
    let waitMs = 1000;

    for (const model of ATTEMPTS) {
        if (timedOut.has(model)) continue;
        if (tries > 0) await new Promise((resolve) => setTimeout(resolve, waitMs + Math.random() * 500));
        waitMs = 1000;
        const attempt = ++tries;
        const started = Date.now();
        const report = (fields: Omit<Attempt, "model" | "attempt" | "latencyMs">) =>
            onAttempt?.({ model, attempt, latencyMs: Date.now() - started, ...fields });

        let res: Response;
        try {
            res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": process.env.GEMINI_API_KEY!,
                    },
                    body,
                    // Give up on one attempt after 12 seconds and move to the next.
                    signal: AbortSignal.timeout(12_000),
                }
            );
        } catch {
            lastProblem = `${model} timed out`;
            timedOut.add(model);
            report({ httpStatus: null, ok: false, rawText: null, error: "timed out" });
            console.error(`Gemini: ${lastProblem}`);
            continue;
        }

        if (!res.ok) {
            lastProblem = `${model} answered ${res.status}`;
            report({
                httpStatus: res.status,
                ok: false,
                rawText: (await res.text().catch(() => "")).slice(0, 2000) || null,
                error: `HTTP ${res.status}`,
            });
            console.error(`Gemini: ${lastProblem}`);
            if (res.status === 429) waitMs = 3000;
            if (RETRYABLE.includes(res.status)) continue;
            break; // A bad key or bad request won't improve by retrying.
        }

        const json = await res.json();

        // The model may reply in several parts; keep the answer, skip its "thinking".
        const answer: Part[] = json.candidates?.[0]?.content?.parts ?? [];
        const text = answer.filter((p) => !p.thought).map((p) => p.text ?? "").join("");

        const usable = accept(text);
        report({
            httpStatus: res.status,
            ok: usable,
            rawText: text.slice(0, 4000),
            error: usable ? null : "no usable answer",
        });
        if (usable) return { text, model };

        lastProblem = `${model} returned no usable answer`;
        console.error(`Gemini: ${lastProblem}`);
    }

    throw new Error(`Gemini failed: ${lastProblem}`);
}

// Never trust the shape of a model's output: keep only real, non-empty strings.
export function parseCaptions(text: string, max = 3): string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text || "[]");
    } catch {
        parsed = [];
    }
    return (Array.isArray(parsed) ? parsed : [])
        .filter((c): c is string => typeof c === "string" && c.trim() !== "")
        .map((c) => c.trim())
        .slice(0, max);
}

// Sends one photo to Gemini with one prompt. Returns the captions and the model that wrote them.
export async function captionImage(
    imageBase64: string,
    mimeType: string,
    prompt: string = PROMPT,
    onAttempt?: (attempt: Attempt) => void
): Promise<{ captions: string[]; model: string }> {
    const { text, model } = await askGemini(
        { prompt, image: { base64: imageBase64, mimeType }, json: true },
        onAttempt,
        (answer) => parseCaptions(answer).length > 0
    );
    return { captions: parseCaptions(text), model };
}
