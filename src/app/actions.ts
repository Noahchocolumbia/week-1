"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildPrompt, captionImage } from "@/lib/gemini";
import { isFormat, styleById, type MemeFormat } from "@/lib/styles";
import { createClient } from "@/lib/supabase-server";
import { MAX_PHOTO_BYTES, PHOTO_MIME_TYPES } from "@/lib/uploads";

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
    redirect(ok ? "/rate" : "/welcome?error=1");
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

    // The humor style and idea steer what Gemini writes.
    const style = styleById(options.style).id;
    const format: MemeFormat = isFormat(options.format) ? options.format : "top";
    const prompt = buildPrompt(style, options.idea);

    let captions: string[];
    let model: string;
    try {
        ({ captions, model } = await captionImage(bytes.toString("base64"), mimeType, prompt));
    } catch (error) {
        console.error("generateCaptions:", error);
        return discard("The AI is busy right now, so nothing was saved. Try again in a minute.");
    }

    // profile_id is filled in by the database (default auth.uid()), and RLS checks it.
    const { data: image, error: imageError } = await supabase
        .from("images")
        .insert({ storage_path: path, style, format })
        .select("id")
        .single<{ id: string }>();
    if (imageError || !image) return discard("Couldn't save the photo.");

    // One row per caption, each recording the prompt and model that produced it.
    const { error: captionError } = await supabase
        .from("captions")
        .insert(captions.map((content) => ({ image_id: image.id, content, prompt, model })));
    if (captionError) {
        // Roll back the just-inserted draft so it (and its photo) aren't left behind.
        await supabase.from("images").delete().eq("id", image.id);
        return discard("Couldn't save the captions.");
    }

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

// Deletes one caption (and any votes on it).
export async function deleteCaption(captionId: string) {
    const { supabase, user } = await signedIn();
    if (!user) return { ok: false };
    if (typeof captionId !== "string" || !UUID.test(captionId)) return { ok: false };

    const { data } = await supabase
        .from("captions")
        .delete()
        .eq("id", captionId)
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

    // Then remove the file itself from Storage.
    await supabase.storage.from("photos").remove([deleted.storage_path]);

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

    const style = styleById(options.style ?? image.style).id;
    const prompt = buildPrompt(style, options.idea);

    let captions: string[];
    let model: string;
    try {
        ({ captions, model } = await captionImage(photo.bytes.toString("base64"), photo.mimeType, prompt));
    } catch (error) {
        console.error("regenerateCaptions:", error);
        return { ok: false, error: "The AI is busy right now. Your old captions are still here." };
    }

    const { error: deleteError } = await supabase.from("captions").delete().eq("image_id", image.id);
    if (deleteError) return { ok: false, error: "Couldn't replace the captions." };

    const { error: insertError } = await supabase
        .from("captions")
        .insert(captions.map((content) => ({ image_id: image.id, content, prompt, model })));
    if (insertError) return { ok: false, error: "Couldn't save the new captions." };

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

    const { data } = await supabase
        .from("captions")
        .update({ content: text, edited: true })
        .eq("id", captionId)
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
