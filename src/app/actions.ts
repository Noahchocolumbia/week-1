"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadChain, runChain, type Chain } from "@/lib/chains";
import { buildPrompt, captionImage, type Attempt } from "@/lib/gemini";
import { AFTER_LOGIN_COOKIE, safeNext } from "@/lib/after-login";
import { GenerationLog } from "@/lib/genlog";
import { HUMOR_STYLES, isFormat, MIX_STYLE, pickStyle, type MemeFormat } from "@/lib/styles";
import { createClient } from "@/lib/supabase-server";
import { MAX_PHOTO_BYTES, PHOTO_MIME_TYPES } from "@/lib/uploads";

// Writes captions for a photo: through the style's prompt chain if it has one (see src/lib/chains.ts),
// otherwise with one prompt. Returns the prompt text that gets saved with each caption.
async function writeCaptions(
    chain: Chain | null,
    style: string,
    idea: string | undefined,
    photo: { bytes: Buffer; mimeType: string },
    record: (attempt: Attempt) => void,
    count = 3
) {
    const image = { base64: photo.bytes.toString("base64"), mimeType: photo.mimeType };
    if (chain) return runChain(chain, image, idea, record, count);
    let prompt = buildPrompt(style, idea);
    if (count === 1) prompt += " Return only the single strongest caption, as a JSON array with 1 string.";
    const { captions, model } = await captionImage(image.base64, image.mimeType, prompt, record);
    return { captions: captions.slice(0, count), model, prompt };
}

type NewCaption = { content: string; style: string; model: string; prompt: string };

// Captions for one photo, as rows ready to save.
// "mix" runs every style's chain at the same time, one caption each, and keeps whichever succeed.
// A single style writes three captions in that style.
async function captionsFor(
    supabase: Supabase,
    style: string,
    idea: string | undefined,
    photo: { bytes: Buffer; mimeType: string },
    record: (attempt: Attempt) => void
): Promise<NewCaption[]> {
    if (style !== MIX_STYLE.id) {
        const chain = await loadChain(supabase, style);
        const { captions, model, prompt } = await writeCaptions(chain, style, idea, photo, record);
        return captions.map((content) => ({ content, style, model, prompt }));
    }

    const started = Date.now();
    const runStyle = async (styleId: string) => {
        const chain = await loadChain(supabase, styleId);
        const { captions, model, prompt } = await writeCaptions(chain, styleId, idea, photo, record, 1);
        return captions.map((content) => ({ content, style: styleId, model, prompt }));
    };

    // Start the chains a moment apart instead of all at once: four chains firing together
    // is twelve Gemini calls in a burst, which trips Gemini's rate limit (HTTP 429).
    const results = await Promise.allSettled(
        HUMOR_STYLES.map(async (s, i) => {
            await new Promise((resolve) => setTimeout(resolve, i * 700));
            return runStyle(s.id);
        })
    );
    const rows = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

    // Any chain that failed gets one more try, one at a time, so the mix still ends up
    // with one caption per style. Skipped if time is running short (the page allows 60s).
    const failed = HUMOR_STYLES.filter((_, i) => results[i].status === "rejected");
    for (const s of failed) {
        if (Date.now() - started > 25_000) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
            rows.push(...(await runStyle(s.id)));
        } catch (error) {
            console.error(`Chain mix: ${s.name} failed twice`, error);
        }
    }

    if (rows.length === 0) throw new Error("Every chain in the mix failed");
    // Keep the styles in their usual order even when a retry finished last.
    const order = HUMOR_STYLES.map((s) => s.id);
    return rows.sort((a, b) => order.indexOf(a.style) - order.indexOf(b.style));
}

// One line for the generation log: which chains ran.
function describeRun(style: string) {
    return style === MIX_STYLE.id
        ? `Chain mix: ${HUMOR_STYLES.map((s) => s.name).join(" + ")}`
        : `Chain: ${pickStyle(style).name}`;
}

// What a generation log records as "the model": every model that wrote a caption.
function modelsUsed(rows: NewCaption[]) {
    return [...new Set(rows.map((r) => r.model))].join(", ");
}

// Shared by the welcome form and the profile form.
async function saveNames(formData: FormData) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const first_name = String(formData.get("first_name") ?? "").trim();
    const last_name = String(formData.get("last_name") ?? "").trim();
    if (!first_name || !last_name) return false;

    // upsert = update the row, or create it if the trigger somehow didn't.
    const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, first_name, last_name });

    revalidatePath("/", "layout");
    return !error;
}

export async function completeWelcome(formData: FormData) {
    const ok = await saveNames(formData);
    if (!ok) redirect("/welcome?error=1");
    const jar = await cookies();
    const goTo = safeNext(decodeURIComponent(jar.get(AFTER_LOGIN_COOKIE)?.value ?? ""));
    jar.delete(AFTER_LOGIN_COOKIE);
    redirect(goTo);
}

export async function updateProfile(formData: FormData) {
    const ok = await saveNames(formData);
    redirect(ok ? "/profile?saved=1" : "/profile?error=1");
}

// The photo itself is uploaded to Storage from the browser.
// This only records where it is.
export async function saveAvatarPath(path: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Users may only point at files inside their own folder.
    if (!path.startsWith(`${user.id}/`)) return { ok: false };

    const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_path: path });

    revalidatePath("/", "layout");
    return { ok: !error };
}

// --- Assignment 4: AI captions ---

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Downloads a photo from the public "photos" bucket and checks its type and size.
async function readPhoto(supabase: Supabase, path: string) {
    const { publicUrl } = supabase.storage.from("photos").getPublicUrl(path).data;
    const res = await fetch(publicUrl);
    if (!res.ok) return { ok: false as const, error: "read" as const };

    const mimeType = (res.headers.get("content-type") ?? "").split(";")[0];
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!PHOTO_MIME_TYPES.includes(mimeType) || bytes.length > MAX_PHOTO_BYTES) {
        return { ok: false as const, error: "type" as const };
    }
    return { ok: true as const, bytes, mimeType };
}

export type GenerateResult = { ok: true; imageId: string } | { ok: false; error: string };

// The browser has already uploaded the photo to the "photos" bucket.
// This asks Gemini for captions, then saves the photo and its captions as rows.
// The photo starts as a draft (published = false): only its owner can see it until they save it.
export type StudioOptions = { style?: string; idea?: string; format?: MemeFormat };

export async function generateCaptions(path: string, options: StudioOptions = {}): Promise<GenerateResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to generate captions." };

    // Users may only caption photos inside their own folder.
    if (typeof path !== "string" || !path.startsWith(`${user.id}/`) || path.includes("..")) {
        return { ok: false, error: "That photo isn't yours." };
    }

    // If anything below fails, remove the uploaded file so it isn't left behind.
    async function discard(error: string): Promise<GenerateResult> {
        await supabase.storage.from("photos").remove([path]);
        return { ok: false, error };
    }

    // Fetch the photo back from Storage so it can be sent to Gemini.
    const photo = await readPhoto(supabase, path);
    if (!photo.ok) return photo.error === "type" ? discard("Use a JPEG, PNG or WebP photo under 5 MB.") : { ok: false, error: "Couldn't read the uploaded photo." };
    const { bytes, mimeType } = photo;

    // Every new photo gets the chain mix: one caption from each humor style.
    // A single style is still available afterwards through Regenerate.
    const style = options.style && options.style !== MIX_STYLE.id ? pickStyle(options.style).id : MIX_STYLE.id;
    const format: MemeFormat = isFormat(options.format) ? options.format : "top";

    // Logged for the admin panel's generation requests and LLM responses.
    const log = new GenerationLog(supabase);
    await log.start({ kind: "generate", style, prompt: describeRun(style) });

    let rows: NewCaption[];
    try {
        rows = await captionsFor(supabase, style, options.idea, { bytes, mimeType }, log.record);
    } catch (error) {
        console.error("generateCaptions:", error);
        await log.finish({ ok: false, error: error instanceof Error ? error.message : "Gemini failed" });
        return discard("The AI is busy right now, so nothing was saved. Try again in a minute.");
    }

    // profile_id is filled in by the database (default auth.uid()), and RLS checks it.
    const { data: image, error: imageError } = await supabase
        .from("images")
        .insert({ storage_path: path, style, format })
        .select("id")
        .single<{ id: string }>();
    if (imageError || !image) {
        await log.finish({ ok: false, error: "Captions written, but the photo row couldn't be saved." });
        return discard("Couldn't save the photo.");
    }

    // One row per caption, each recording the style, prompt and model that produced it.
    const { error: captionError } = await supabase
        .from("captions")
        .insert(rows.map((row) => ({ image_id: image.id, ...row })));
    if (captionError) {
        // Roll back the just-inserted draft so it (and its photo) aren't left behind.
        await supabase.from("images").delete().eq("id", image.id);
        await log.finish({ ok: false, error: "Captions written, but they couldn't be saved." });
        return discard("Couldn't save the captions.");
    }

    await log.finish({ ok: true, model: modelsUsed(rows), captionCount: rows.length, imageId: image.id });
    revalidatePath("/generate");
    return { ok: true, imageId: image.id };
}

// --- Assignment 4: voting ---

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Records the signed-in user's vote on a caption: 1 is an upvote, -1 a downvote,
// and 0 takes their vote back.
export async function castVote(captionId: string, vote: 1 | -1 | 0) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    // Arguments come from the browser, so check them before using them.
    if (typeof captionId !== "string" || !UUID.test(captionId)) return { ok: false };
    if (vote !== 1 && vote !== -1 && vote !== 0) return { ok: false };

    if (vote === 0) {
        // RLS only lets a user delete their own vote rows.
        const { error } = await supabase
            .from("caption_votes")
            .delete()
            .eq("caption_id", captionId)
            .eq("profile_id", user.id);
        revalidateFeed();
        return { ok: !error };
    }

    // upsert = insert a new vote row, or change this user's existing vote on this caption.
    const { error } = await supabase
        .from("caption_votes")
        .upsert(
            { caption_id: captionId, profile_id: user.id, vote },
            { onConflict: "caption_id,profile_id" }
        );

    revalidateFeed();
    return { ok: !error };
}

// Every page that shows memes or scores.
function revalidateFeed() {
    revalidatePath("/");
    revalidatePath("/rate");
    revalidatePath("/top");
    revalidatePath("/profile");
}

// --- Assignment 4: managing your own photos ---

async function signedIn() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return { supabase, user };
}

// "Save": moves a draft photo and its remaining captions into the Rate feed.
export async function publishImage(imageId: string) {
    const { supabase, user } = await signedIn();
    if (!user) return { ok: false };
    if (typeof imageId !== "string" || !UUID.test(imageId)) return { ok: false };

    // RLS only lets this match a row the user owns. Asking for the row back
    // tells us whether anything was actually changed.
    const { data } = await supabase
        .from("images")
        .update({ published: true })
        .eq("id", imageId)
        .select("id")
        .maybeSingle<{ id: string }>();
    if (!data) return { ok: false };

    revalidatePath("/generate");
    revalidateFeed();
    return { ok: true };
}

// "Post selected": posts the chosen captions from a draft and keeps the rest as drafts.
// The chosen captions move onto a published copy of the photo row (same file in Storage),
// so the draft can keep its other captions for later. Choosing all of them posts the draft itself.
export async function publishCaptions(imageId: string, captionIds: string[]) {
    const { supabase, user } = await signedIn();
    if (!user) return { ok: false };
    if (typeof imageId !== "string" || !UUID.test(imageId)) return { ok: false };
    const ids = Array.isArray(captionIds) ? [...new Set(captionIds)] : [];
    if (ids.length === 0 || !ids.every((id) => typeof id === "string" && UUID.test(id))) return { ok: false };

    const { data: draft } = await supabase
        .from("images")
        .select("id, storage_path, style, format, published, captions(id)")
        .eq("id", imageId)
        .eq("profile_id", user.id)
        .maybeSingle<{ id: string; storage_path: string; style: string; format: string; published: boolean; captions: { id: string }[] }>();
    if (!draft || draft.published) return { ok: false };
    const onDraft = new Set(draft.captions.map((c) => c.id));
    if (!ids.every((id) => onDraft.has(id))) return { ok: false };

    // Everything chosen: post the draft itself, nothing to split off.
    if (ids.length === draft.captions.length) return publishImage(imageId);

    const { data: posted } = await supabase
        .from("images")
        .insert({ storage_path: draft.storage_path, style: draft.style, format: draft.format, published: true })
        .select("id")
        .single<{ id: string }>();
    if (!posted) return { ok: false };

    const { data: moved } = await supabase
        .from("captions")
        .update({ image_id: posted.id })
        .in("id", ids)
        .eq("image_id", draft.id)
        .select("id");
    if (!moved || moved.length !== ids.length) {
        // Put back anything that moved, then remove the copy (not the file: the draft still uses it).
        if (moved?.length) await supabase.from("captions").update({ image_id: draft.id }).in("id", moved.map((c) => c.id));
        await supabase.from("images").delete().eq("id", posted.id);
        return { ok: false };
    }

    revalidatePath("/generate");
    revalidateFeed();
    return { ok: true };
}

// Deletes one caption (and any votes on it).
export async function deleteCaption(captionId: string) {
    const { supabase, user } = await signedIn();
    if (!user) return { ok: false };
    if (typeof captionId !== "string" || !UUID.test(captionId)) return { ok: false };

    const { data } = await supabase
        .from("captions")
        .delete()
        .eq("id", captionId)
        .eq("profile_id", user.id)
        .select("id")
        .maybeSingle<{ id: string }>();
    if (!data) return { ok: false };

    revalidatePath("/generate");
    revalidateFeed();
    return { ok: true };
}

// Deletes a photo. The database removes its captions and their votes with it
// (the tables are linked with "on delete cascade").
export async function deleteImage(imageId: string) {
    const { supabase, user } = await signedIn();
    if (!user) return { ok: false };
    if (typeof imageId !== "string" || !UUID.test(imageId)) return { ok: false };

    const { data: deleted } = await supabase
        .from("images")
        .delete()
        .eq("id", imageId)
        .select("storage_path")
        .maybeSingle<{ storage_path: string }>();
    if (!deleted) return { ok: false };

    // Then remove the file itself from Storage, unless a posted meme still uses it
    // ("Post this one" gives each posted caption its own row that shares the draft's file).
    const { count } = await supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .eq("storage_path", deleted.storage_path);
    if (!count) await supabase.storage.from("photos").remove([deleted.storage_path]);

    revalidatePath("/generate");
    revalidateFeed();
    return { ok: true };
}

// "New captions": asks the AI again for a draft photo and replaces its captions.
// The old captions are only removed once the new ones are ready.
// "Regenerate" keeps the photo's style; "Remix" passes a different one.
export async function regenerateCaptions(
    imageId: string,
    options: { style?: string; idea?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
    const { supabase, user } = await signedIn();
    if (!user) return { ok: false, error: "Sign in first." };
    if (typeof imageId !== "string" || !UUID.test(imageId)) return { ok: false };

    // RLS: only the owner's own row comes back. Posted photos keep their captions (and votes).
    const { data: image } = await supabase
        .from("images")
        .select("id, storage_path, published, style")
        .eq("id", imageId)
        .eq("profile_id", user.id)
        .maybeSingle<{ id: string; storage_path: string; published: boolean; style: string }>();
    if (!image) return { ok: false, error: "Couldn't find that photo." };
    if (image.published) return { ok: false, error: "Posted memes keep their captions." };

    const photo = await readPhoto(supabase, image.storage_path);
    if (!photo.ok) return { ok: false, error: "Couldn't read that photo." };

    // "mix" reruns every chain; a style id rewrites all the captions in that one style.
    const wanted = options.style ?? image.style;
    const style = wanted === MIX_STYLE.id ? MIX_STYLE.id : pickStyle(wanted).id;

    const log = new GenerationLog(supabase);
    await log.start({ kind: "regenerate", style, prompt: describeRun(style), imageId: image.id });

    let rows: NewCaption[];
    try {
        rows = await captionsFor(supabase, style, options.idea, photo, log.record);
    } catch (error) {
        console.error("regenerateCaptions:", error);
        await log.finish({ ok: false, error: error instanceof Error ? error.message : "Gemini failed" });
        return { ok: false, error: "The AI is busy right now. Your old captions are still here." };
    }

    const { error: deleteError } = await supabase.from("captions").delete().eq("image_id", image.id);
    if (deleteError) {
        await log.finish({ ok: false, error: "Captions written, but the old ones couldn't be replaced." });
        return { ok: false, error: "Couldn't replace the captions." };
    }

    const { error: insertError } = await supabase
        .from("captions")
        .insert(rows.map((row) => ({ image_id: image.id, ...row })));
    if (insertError) {
        await log.finish({ ok: false, error: "Captions written, but they couldn't be saved." });
        return { ok: false, error: "Couldn't save the new captions." };
    }
    await log.finish({ ok: true, model: modelsUsed(rows), captionCount: rows.length });

    // Remember the style, so the label on the meme matches what wrote it.
    if (style !== image.style) await supabase.from("images").update({ style }).eq("id", image.id);

    revalidatePath("/generate");
    return { ok: true };
}

// Saves a person's rewrite of an AI caption on one of their drafts.
// RLS only allows this on the owner's own unpublished photos.
export async function updateCaption(captionId: string, content: string): Promise<{ ok: boolean; error?: string }> {
    const { supabase, user } = await signedIn();
    if (!user) return { ok: false, error: "Sign in first." };
    if (typeof captionId !== "string" || !UUID.test(captionId)) return { ok: false };

    const text = String(content ?? "").replace(/\s+/g, " ").trim();
    if (!text) return { ok: false, error: "A caption needs at least one word." };
    if (text.length > 140) return { ok: false, error: "Keep it under 140 characters." };

    // Defense in depth: scope to this user's own caption, don't rely on RLS alone
    // (matches castVote/publishImage/setFormat). RLS still enforces draft-only.
    const { data } = await supabase
        .from("captions")
        .update({ content: text, edited: true })
        .eq("id", captionId)
        .eq("profile_id", user.id)
        .select("id")
        .maybeSingle<{ id: string }>();
    if (!data) return { ok: false, error: "Only drafts can be edited." };

    revalidatePath("/generate");
    return { ok: true };
}

// Changes the layout of one of your memes (caption above, on, or under the photo).
export async function setFormat(imageId: string, format: MemeFormat): Promise<{ ok: boolean }> {
    const { supabase, user } = await signedIn();
    if (!user) return { ok: false };
    if (typeof imageId !== "string" || !UUID.test(imageId) || !isFormat(format)) return { ok: false };

    const { data } = await supabase
        .from("images")
        .update({ format })
        .eq("id", imageId)
        .eq("profile_id", user.id)
        .select("id")
        .maybeSingle<{ id: string }>();
    if (!data) return { ok: false };

    revalidatePath("/generate");
    revalidateFeed();
    return { ok: true };
}
