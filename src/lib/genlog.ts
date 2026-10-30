import "server-only";
import type { Attempt } from "@/lib/gemini";
import type { createClient } from "@/lib/supabase-server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Observability for the admin panel: one generation_requests row per caption request,
// one llm_responses row per model call. The database links the style to its prompt chain
// and the model name to its llm_models row.
//
// Logging must never break caption generation, so every call here swallows its own errors.
export class GenerationLog {
    private id: string | null = null;
    readonly attempts: Attempt[] = [];

    constructor(private supabase: Supabase) {}

    // Pass to captionImage() to collect each model call.
    record = (attempt: Attempt) => {
        this.attempts.push(attempt);
    };

    async start(fields: { kind: "generate" | "regenerate"; style: string; prompt: string; imageId?: string }) {
        try {
            const { data } = await this.supabase
                .from("generation_requests")
                .insert({ kind: fields.kind, style: fields.style, prompt: fields.prompt, image_id: fields.imageId ?? null })
                .select("id")
                .single<{ id: string }>();
            this.id = data?.id ?? null;
        } catch (error) {
            console.error("GenerationLog.start:", error);
        }
    }

    async finish(result: { ok: true; model: string; captionCount: number; imageId?: string } | { ok: false; error: string }) {
        if (!this.id) return;
        try {
            if (this.attempts.length) {
                await this.supabase.from("llm_responses").insert(
                    this.attempts.map((a) => ({
                        request_id: this.id,
                        model_name: a.model,
                        attempt: a.attempt,
                        http_status: a.httpStatus,
                        ok: a.ok,
                        raw_text: a.rawText,
                        latency_ms: a.latencyMs,
                        error: a.error,
                    }))
                );
            }
            await this.supabase
                .from("generation_requests")
                .update(
                    result.ok
                        ? {
                              status: "succeeded",
                              model_used: result.model,
                              caption_count: result.captionCount,
                              completed_at: new Date().toISOString(),
                              ...(result.imageId ? { image_id: result.imageId } : {}),
                          }
                        : { status: "failed", error: result.error.slice(0, 500), completed_at: new Date().toISOString() }
                )
                .eq("id", this.id);
        } catch (error) {
            console.error("GenerationLog.finish:", error);
        }
    }
}
