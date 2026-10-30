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
    "You write captions for a photo feed used by college students in New York City. " +
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

// Sends one photo to Gemini. Returns the captions and the model that wrote them.
export async function captionImage(
    imageBase64: string,
    mimeType: string,
    prompt: string = PROMPT,
    onAttempt?: (attempt: Attempt) => void
): Promise<{ captions: string[]; model: string }> {
    const body = JSON.stringify({
        contents: [
            {
                parts: [
                    { inline_data: { mime_type: mimeType, data: imageBase64 } },
                    { text: prompt },
                ],
            },
        ],
        // Ask for raw JSON instead of prose, so JSON.parse works.
        generationConfig: { responseMimeType: "application/json" },
    });

    let lastProblem = "no attempt made";
    const timedOut = new Set<string>();
    let tries = 0;

    for (const model of ATTEMPTS) {
        if (timedOut.has(model)) continue;
        if (tries > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
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
            if (RETRYABLE.includes(res.status)) continue;
            break; // A bad key or bad request won't improve by retrying.
        }

        const json = await res.json();

        // The model may reply in several parts; keep the answer, skip its "thinking".
        const parts: Part[] = json.candidates?.[0]?.content?.parts ?? [];
        const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("") || "[]";

        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = [];
        }

        // Never trust the shape of a model's output: keep only real, non-empty strings.
        const captions = (Array.isArray(parsed) ? parsed : [])
            .filter((c): c is string => typeof c === "string" && c.trim() !== "")
            .map((c) => c.trim())
            .slice(0, 3);

        report({
            httpStatus: res.status,
            ok: captions.length > 0,
            rawText: text.slice(0, 4000),
            error: captions.length > 0 ? null : "no usable captions",
        });
        if (captions.length > 0) return { captions, model };

        lastProblem = `${model} returned no usable captions`;
        console.error(`Gemini: ${lastProblem}`);
    }

    throw new Error(`Gemini failed: ${lastProblem}`);
}
