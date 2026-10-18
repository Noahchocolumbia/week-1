"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
    deleteCaption,
    deleteImage,
    generateCaptions,
    publishImage,
    regenerateCaptions,
    setFormat,
    updateCaption,
} from "@/app/actions";
import Cooking from "@/components/Cooking";
import Magnetic from "@/components/Magnetic";
import MemeImage from "@/components/MemeImage";
import { useApp } from "@/components/Providers";
import ShareControls from "@/components/ShareControls";
import { createClient } from "@/lib/supabase";
import { HUMOR_STYLES, MEME_FORMATS, assess, promptQuip, styleById, type MemeFormat } from "@/lib/styles";

export type StudioCaption = { id: string; content: string; edited: boolean; score: number; votes: number };
export type StudioImage = {
    id: string;
    url: string;
    style: string;
    format: MemeFormat;
    published: boolean;
    captions: StudioCaption[];
};

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const LETTERS = ["A", "B", "C", "D", "E"];

export default function Studio({
    userId,
    drafts,
    posted,
    initialIdea,
}: {
    userId: string;
    drafts: StudioImage[];
    posted: StudioImage[];
    initialIdea: string;
}) {
    const { toast } = useApp();

    // --- Control panel ---
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [idea, setIdea] = useState(initialIdea);
    const [styleId, setStyleId] = useState(HUMOR_STYLES[0].id);
    const [format, setFormatChoice] = useState<MemeFormat>("top");
    const [cooking, setCooking] = useState<null | { styleId: string }>(null);
    const [error, setError] = useState("");

    // --- Workspace ---
    const [activeId, setActiveId] = useState<string | null>(drafts[0]?.id ?? null);
    const active = drafts.find((d) => d.id === activeId) ?? null;

    const style = styleById(styleId);
    const quip = promptQuip(idea);

    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    }, [preview]);

    function pickFile(next: File | undefined | null) {
        setError("");
        if (!next) return;
        if (!TYPES[next.type]) return setError("Error: that's not a photo we can read. Use JPEG, PNG or WebP.");
        if (next.size > MAX_BYTES) return setError("Error: photo exceeds 5 MB. Even memes have limits.");
        setFile(next);
        setPreview(URL.createObjectURL(next));
    }

    async function onGenerate() {
        if (!file) return setError("Error: no evidence submitted. Add a photo first.");
        const ext = TYPES[file.type];
        setError("");
        setCooking({ styleId });

        // 1. The photo goes to Supabase Storage, in a folder named after the user.
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await createClient()
            .storage.from("photos")
            .upload(path, file, { contentType: file.type });
        if (uploadError) {
            setCooking(null);
            return setError("Error: upload failed. The internet blinked. Try again.");
        }

        // 2. The server asks Gemini for captions in the chosen style and saves a draft.
        const result = await generateCaptions(path, { style: styleId, idea, format });
        setCooking(null);
        if (!result.ok) return setError(`Error: ${result.error}`);

        setFile(null);
        setPreview(null);
        setActiveId(result.imageId);
        toast("Meme successfully weaponized.");
    }

    return (
        <>
            <div className="studio">
                {/* ---------------- Control panel ---------------- */}
                <section className="studio-panel" aria-label="Meme settings">
                    <div className="studio-bar mono">
                        <span className="lights" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                        </span>
                        <span>Control panel v4.20</span>
                    </div>

                    <div className="step">
                        <div className="step-label">
                            <strong>01 Evidence</strong>
                            <span className="mono">Required</span>
                        </div>
                        <label
                            className={`dropzone ${dragging ? "is-over" : ""}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                pickFile(e.dataTransfer.files?.[0]);
                            }}
                        >
                            {preview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={preview} alt="The photo you picked" />
                            ) : (
                                <>
                                    <strong>Drop a photo</strong>
                                    <small className="mono">or click to choose. JPEG, PNG, WebP. Max 5 MB.</small>
                                </>
                            )}
                            {preview && <small className="mono">Click to swap the photo</small>}
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="visually-hidden"
                                disabled={Boolean(cooking)}
                                onChange={(e) => {
                                    pickFile(e.target.files?.[0]);
                                    e.target.value = "";
                                }}
                            />
                        </label>
                    </div>

                    <div className="step">
                        <div className="step-label">
                            <strong>02 The idea</strong>
                            <span className="mono">Optional</span>
                        </div>
                        <label className="visually-hidden" htmlFor="idea">
                            What should the joke be about?
                        </label>
                        <textarea
                            id="idea"
                            className="textarea"
                            value={idea}
                            maxLength={200}
                            placeholder="e.g. this is what Butler looks like during finals"
                            onChange={(e) => setIdea(e.target.value)}
                        />
                        <p className="mono quip" aria-live="polite">
                            {quip ?? ""}
                        </p>
                    </div>

                    <div className="step">
                        <div className="step-label">
                            <strong>03 Humor style</strong>
                            <span className="mono">{HUMOR_STYLES.length} flavors</span>
                        </div>
                        <div className="styles-grid" role="group" aria-label="Humor style">
                            {HUMOR_STYLES.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    className="style-option"
                                    aria-pressed={styleId === s.id}
                                    onClick={() => setStyleId(s.id)}
                                    title={s.blurb}
                                >
                                    {styleId === s.id && (
                                        <motion.span
                                            layoutId="style-highlight"
                                            className="highlight"
                                            style={{ background: s.color }}
                                            transition={{ type: "spring", stiffness: 500, damping: 34 }}
                                        />
                                    )}
                                    {s.name}
                                </button>
                            ))}
                        </div>
                        <div className="style-readout">
                            <p>{style.blurb}</p>
                            <div className="chaos-meter" aria-label={`Chaos level ${style.chaos} out of 100`}>
                                <p className="mono">
                                    <span>Chaos</span>
                                    <span>{style.chaos}%</span>
                                </p>
                                <div className="chaos-bars" aria-hidden="true">
                                    {Array.from({ length: 10 }, (_, i) => (
                                        <motion.i
                                            key={i}
                                            className={`${i < Math.round(style.chaos / 10) ? "on" : ""} ${i >= 8 ? "hot" : ""}`}
                                            animate={{ scaleY: i < Math.round(style.chaos / 10) ? 1 : 0.5 }}
                                            transition={{ delay: i * 0.02 }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="step">
                        <div className="step-label">
                            <strong>04 Format</strong>
                            <span className="mono">{MEME_FORMATS.find((f) => f.id === format)?.hint}</span>
                        </div>
                        <div className="segmented" role="group" aria-label="Meme format">
                            {MEME_FORMATS.map((f) => (
                                <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => setFormatChoice(f.id)}>
                                    {f.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="generate-step">
                        <Magnetic strength={0.12}>
                            <button
                                type="button"
                                className="btn btn-primary btn-big"
                                onClick={onGenerate}
                                disabled={Boolean(cooking)}
                                title="There is no undo for comedy. (There is a delete button.)"
                            >
                                {cooking ? "Cooking..." : "Generate brainrot →"}
                            </button>
                        </Magnetic>
                        {error ? (
                            <p className="error-line" role="alert" style={{ marginTop: 10 }}>
                                {error}
                            </p>
                        ) : (
                            <p className="mono">Three captions. One photo. No refunds.</p>
                        )}
                    </div>
                </section>

                {/* ---------------- Workspace ---------------- */}
                <section className="workspace" aria-label="Workspace">
                    <div className="studio-bar mono">
                        <span>Workspace</span>
                        <span>{active ? `Draft ${active.id.slice(0, 6)}` : "Idle"}</span>
                    </div>
                    {cooking ? (
                        <Cooking styleName={styleById(cooking.styleId).name} color={styleById(cooking.styleId).color} />
                    ) : active ? (
                        <Workspace key={active.id} draft={active} idea={idea} onGone={() => setActiveId(null)} />
                    ) : (
                        <div className="workspace-idle">
                            <div>
                                <h2 className="display wide">Workspace idle.</h2>
                                <p>
                                    Awaiting evidence. Add a photo, pick a humor style, and press the yellow button.
                                    Results appear here for editing before anything goes public.
                                </p>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {drafts.length > 0 && (
                <section style={{ marginTop: 48 }}>
                    <div className="section-head" style={{ marginBottom: 20 }}>
                        <h2 className="display wide" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}>
                            Drafts
                        </h2>
                        <p className="section-note mono">Only you can see these</p>
                    </div>
                    <div className="shelf">
                        {drafts.map((d) => (
                            <button
                                key={d.id}
                                type="button"
                                className="shelf-item"
                                aria-pressed={d.id === activeId}
                                onClick={() => {
                                    setActiveId(d.id);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={d.url} alt="" />
                                <span className="mono">
                                    <span style={{ color: styleById(d.style).color }}>{styleById(d.style).name}</span>
                                    <span>{d.captions.length} cap.</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section style={{ marginTop: 56 }}>
                <div className="section-head" style={{ marginBottom: 20 }}>
                    <h2 className="display wide" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}>
                        Your published crimes
                    </h2>
                    <p className="section-note mono">{posted.length} on the public record</p>
                </div>
                {posted.length === 0 ? (
                    <div className="empty">
                        <p style={{ marginBottom: 0 }}>Clean record so far. Post a draft to change that.</p>
                    </div>
                ) : (
                    <div className="gallery">
                        {posted.map((image) => (
                            <PostedCard key={image.id} image={image} />
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}

// The editing workspace for one draft: pick a variation, edit, remix, export, post.
function Workspace({ draft, idea, onGone }: { draft: StudioImage; idea: string; onGone: () => void }) {
    const { toast } = useApp();
    const [pending, startTransition] = useTransition();
    const [pick, setPick] = useState(0);
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState("");
    const [remixStyle, setRemixStyle] = useState(
        HUMOR_STYLES.find((s) => s.id !== draft.style)?.id ?? HUMOR_STYLES[0].id
    );
    const [busy, setBusy] = useState<null | "regen" | "remix">(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState("");

    const captions = draft.captions;
    const current = captions[Math.min(pick, Math.max(0, captions.length - 1))];
    const style = styleById(draft.style);

    function run(action: () => Promise<{ ok: boolean; error?: string }>, fail: string, done?: () => void) {
        setError("");
        startTransition(async () => {
            const result = await action();
            if (!result.ok) setError(`Error: ${result.error ?? fail}`);
            else done?.();
        });
    }

    async function regenerate(mode: "regen" | "remix") {
        setBusy(mode);
        setError("");
        const result = await regenerateCaptions(draft.id, mode === "remix" ? { style: remixStyle, idea } : { idea });
        setBusy(null);
        if (!result.ok) return setError(`Error: ${result.error ?? "the AI declined. Try again."}`);
        setPick(0);
        setEditing(false);
        toast(mode === "remix" ? `Remixed as ${styleById(remixStyle).name}. No one asked.` : "Fresh captions. Same photo. New crimes.");
    }

    if (busy) {
        const s = styleById(busy === "remix" ? remixStyle : draft.style);
        return <Cooking styleName={s.name} color={s.color} />;
    }

    return (
        <div className="workspace-body">
            <div>
                <div className="workspace-canvas">
                    {current ? (
                        <MemeImage url={draft.url} caption={current.content} format={draft.format} size="large" eager />
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.url} alt="Your photo" style={{ display: "block", width: "100%" }} />
                    )}
                </div>
                <div className="tool-row" style={{ marginTop: 18, justifyContent: "center" }}>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={pending || captions.length === 0}
                        onClick={() =>
                            run(() => publishImage(draft.id), "couldn't post. Try again.", () => {
                                toast("Published. The public has been warned.");
                                onGone();
                            })
                        }
                        title="Every remaining variation goes to the feed"
                    >
                        Post to feed
                    </button>
                    {current && <ShareControls captionId={current.id} url={draft.url} caption={current.content} format={draft.format} showLink={false} />}
                    {confirmDelete ? (
                        <>
                            <button
                                type="button"
                                className="btn btn-danger btn-small"
                                disabled={pending}
                                onClick={() => run(() => deleteImage(draft.id), "couldn't delete it.", () => onGone())}
                            >
                                Yes, destroy it
                            </button>
                            <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirmDelete(false)}>
                                Keep it
                            </button>
                        </>
                    ) : (
                        <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirmDelete(true)}>
                            Delete draft
                        </button>
                    )}
                </div>
                {error && (
                    <p className="error-line" role="alert" style={{ textAlign: "center", marginTop: 12 }}>
                        {error}
                    </p>
                )}
            </div>

            <div className="workspace-side">
                <div>
                    <p className="mono" style={{ color: style.color, marginBottom: 8 }}>
                        {style.name} / {captions.length} variation{captions.length === 1 ? "" : "s"}
                    </p>
                    {captions.length === 0 ? (
                        <p className="mono" style={{ color: "var(--paper-faint)" }}>
                            No captions left. Regenerate for new ones.
                        </p>
                    ) : (
                        <div className="variations" role="group" aria-label="Choose a variation">
                            {captions.map((c, i) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    className="variation"
                                    aria-pressed={c.id === current?.id}
                                    onClick={() => {
                                        setPick(i);
                                        setEditing(false);
                                    }}
                                >
                                    <span className="letter">{LETTERS[i] ?? i + 1}</span>
                                    <span>
                                        {c.content}
                                        {c.edited && <span className="mono human-tag"> (edited)</span>}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {current && (
                    <div className="edit-box">
                        {editing ? (
                            <>
                                <label className="mono" htmlFor="edit-caption" style={{ color: "var(--paper-faint)" }}>
                                    Edit variation {LETTERS[pick]}
                                </label>
                                <textarea
                                    id="edit-caption"
                                    className="textarea"
                                    value={text}
                                    maxLength={140}
                                    onChange={(e) => setText(e.target.value)}
                                />
                                <div className="tool-row">
                                    <button
                                        type="button"
                                        className="btn btn-small btn-primary"
                                        disabled={pending}
                                        onClick={() =>
                                            run(() => updateCaption(current.id, text), "couldn't save the edit.", () => {
                                                setEditing(false);
                                                toast("Edit saved. The AI will pretend this was its idea.");
                                            })
                                        }
                                    >
                                        Save edit
                                    </button>
                                    <button type="button" className="btn btn-small btn-quiet" onClick={() => setEditing(false)}>
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="tool-row">
                                <button
                                    type="button"
                                    className="btn btn-small"
                                    onClick={() => {
                                        setText(current.content);
                                        setEditing(true);
                                    }}
                                    title="Overrule the machine"
                                >
                                    Edit caption
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-small btn-quiet"
                                    disabled={pending}
                                    onClick={() =>
                                        run(() => deleteCaption(current.id), "couldn't delete that caption.", () => setPick(0))
                                    }
                                    title="This variation did not survive review"
                                >
                                    Drop it
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <p className="mono" style={{ color: "var(--paper-faint)", marginBottom: 8 }}>
                        Layout
                    </p>
                    <div className="segmented" role="group" aria-label="Meme format">
                        {MEME_FORMATS.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                aria-pressed={draft.format === f.id}
                                disabled={pending}
                                onClick={() => run(() => setFormat(draft.id, f.id), "couldn't change the layout.")}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="mono" style={{ color: "var(--paper-faint)", marginBottom: 8 }}>
                        Not funny enough?
                    </p>
                    <div className="tool-row">
                        <button type="button" className="btn btn-small" onClick={() => regenerate("regen")} title="Same style, new attempt">
                            Regenerate
                        </button>
                    </div>
                    <div className="tool-row" style={{ marginTop: 6 }}>
                        <label className="visually-hidden" htmlFor="remix-style">
                            Remix in a different style
                        </label>
                        <select id="remix-style" className="select" value={remixStyle} onChange={(e) => setRemixStyle(e.target.value)}>
                            {HUMOR_STYLES.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                        <button type="button" className="btn btn-small" onClick={() => regenerate("remix")} title="Same photo, different personality">
                            Remix
                        </button>
                    </div>
                </div>

                {current && (
                    <div className="assessment">
                        <h3 className="mono">Quality assessment</h3>
                        <dl className="mono">
                            {assess(current.id).map((row) => (
                                <div key={row.label}>
                                    <dt>{row.label}</dt>
                                    <dd>{row.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                )}
            </div>
        </div>
    );
}

// A meme you've posted: its best caption, the scoreboard, share links.
function PostedCard({ image }: { image: StudioImage }) {
    const { toast } = useApp();
    const [pending, startTransition] = useTransition();
    const [confirm, setConfirm] = useState(false);
    const best = [...image.captions].sort((a, b) => b.score - a.score)[0];
    const style = styleById(image.style);
    if (!best) return null;

    return (
        <article className="post">
            <div className="exhibit-label mono">
                <span style={{ color: style.color }}>{style.name}</span>
                <span>Live</span>
            </div>
            <div style={{ padding: "10px 14px 0" }}>
                <MemeImage url={image.url} caption={best.content} format={image.format} size="small" />
            </div>
            <div className="post-foot">
                <ul className="mono" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                    {image.captions.map((c) => (
                        <li key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <Link href={`/m/${c.id}`} className="link" style={{ textTransform: "none", fontFamily: "var(--font-ui)", fontSize: "0.85rem" }}>
                                {c.content}
                            </Link>
                            <span style={{ whiteSpace: "nowrap", color: c.score > 0 ? "var(--yellow)" : "var(--paper-faint)" }}>
                                {c.score > 0 ? `+${c.score}` : c.score} / {c.votes}v
                            </span>
                        </li>
                    ))}
                </ul>
                <ShareControls captionId={best.id} url={image.url} caption={best.content} format={image.format} />
                <div className="tool-row" style={{ marginTop: 8 }}>
                    {confirm ? (
                        <>
                            <button
                                type="button"
                                className="btn btn-danger btn-small"
                                disabled={pending}
                                onClick={() =>
                                    startTransition(async () => {
                                        const r = await deleteImage(image.id);
                                        toast(r.ok ? "Evidence destroyed." : "Couldn't delete it. Try again.");
                                    })
                                }
                            >
                                Yes, delete everywhere
                            </button>
                            <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirm(false)}>
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirm(true)}>
                            Delete
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}
