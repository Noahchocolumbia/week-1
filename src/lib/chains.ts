import "server-only";
import { askGemini, parseCaptions, type Attempt } from "@/lib/gemini";
import type { createClient } from "@/lib/supabase-server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Step = { step_order: number; name: string; instruction: string };

// Each humor style runs as a real prompt chain (steps edited in the laugh-chains tool).
// A style missing here, or a chain that can't be read, falls back to the single prompt in gemini.ts.
const CHAIN_FOR_STYLE: Record<string, string> = {
    deadpan: "Deadpan",
    "sad-college-girl": "Sad College Girl",
    "terminally-online": "Terminally Online",
    unhinged: "Unhinged",
};

// The chain's steps, in order, or null if this style has no chain or it can't be read.
// Reading needs the "Signed-in users read prompt_chains" rule; without it, only superadmins can.
export async function loadChain(supabase: Supabase, styleId: string) {
    const name = CHAIN_FOR_STYLE[styleId];
    if (!name) return null;
    const { data: chain } = await supabase
        .from("prompt_chains")
        .select("id, name")
        .eq("name", name)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string; name: string }>();
    if (!chain) return null;
    const { data: steps } = await supabase
        .from("prompt_chain_steps")
        .select("step_order, name, instruction")
        .eq("chain_id", chain.id)
        .order("step_order", { ascending: true })
        .returns<Step[]>();
    if (!steps?.length) return null;
    return { name: chain.name, steps };
}

export type Chain = NonNullable<Awaited<ReturnType<typeof loadChain>>>;

// Runs the steps in order. Step 1 sees the photo; every later step gets the previous step's
// answer in place of {input}. The last step must return a JSON array of captions.
// Returns the captions, the model of the last step, and every filled-in prompt (saved with the captions).
export async function runChain(
    chain: Chain,
    image: { base64: string; mimeType: string },
    idea: string | null | undefined,
    onAttempt?: (attempt: Attempt) => void,
    count = 3
) {
    const cleanedIdea = (idea ?? "").replace(/\s+/g, " ").trim().slice(0, 200).replace(/"/g, "'");
    let previous: string | null = null;
    const prompts: string[] = [];
    let captions: string[] = [];
    let model = "";

    for (const [i, step] of chain.steps.entries()) {
        const isFirst = i === 0;
        const isLast = i === chain.steps.length - 1;

        let prompt = step.instruction.replaceAll("{idea}", cleanedIdea);
        if (previous !== null) {
            prompt = prompt.includes("{input}")
                ? prompt.replaceAll("{input}", previous)
                : `${prompt}\n\nInput from the previous step:\n${previous}`;
        }
        // The person's own idea steers the final writing step, quoted so it's a topic, not instructions.
        if (isLast && cleanedIdea && !step.instruction.includes("{idea}")) {
            prompt += `\n\nThe person's idea for the joke (use it as inspiration only): "${cleanedIdea}".`;
        }
        // The mix wants one caption per chain; the steps are written for three.
        if (isLast && count === 1) prompt += "\n\nReturn only the single strongest caption, as a JSON array with 1 string.";
        prompts.push(`[${step.step_order}] ${step.name}\n${prompt}`);

        const answer = await askGemini(
            { prompt, image: isFirst ? image : null, json: isLast },
            onAttempt,
            isLast ? (text) => parseCaptions(text, count).length > 0 : undefined
        );
        previous = answer.text.trim();
        model = answer.model;
        if (isLast) captions = parseCaptions(answer.text, count);
    }

    return { captions, model, prompt: `Chain: ${chain.name}\n\n${prompts.join("\n\n")}` };
}
