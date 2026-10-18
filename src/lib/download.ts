"use client";

import type { MemeFormat } from "@/lib/styles";

// Splits text into lines that fit the given width.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= maxWidth || !line) {
            line = next;
        } else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        // The photos bucket is public and sends CORS headers, so the canvas stays exportable.
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Couldn't load the photo."));
        img.src = url;
    });
}

// Draws the meme (photo + caption in its layout) onto a canvas and saves it as a PNG.
export async function downloadMeme(url: string, caption: string, format: MemeFormat, filename = "laugh-or-laugh.png") {
    const img = await loadImage(url);

    // The same Anton the page uses, from the CSS variable next/font sets.
    const family =
        getComputedStyle(document.documentElement).getPropertyValue("--font-meme").trim() || "Impact, sans-serif";
    await document.fonts.load(`64px ${family}`).catch(() => undefined);

    const width = Math.min(1080, img.naturalWidth);
    const photoHeight = Math.round((img.naturalHeight / img.naturalWidth) * width);
    const text = caption.toUpperCase();
    const padding = Math.round(width * 0.04);

    const measure = document.createElement("canvas").getContext("2d")!;
    let fontSize = Math.round(width * (format === "overlay" ? 0.085 : 0.068));
    let lines: string[] = [];
    // Shrink the type until the caption fits in four lines.
    for (; fontSize > 18; fontSize -= 2) {
        measure.font = `${fontSize}px ${family}`;
        lines = wrap(measure, text, width - padding * 2);
        if (lines.length <= 4) break;
    }
    const lineHeight = Math.round(fontSize * 1.1);
    const band = format === "overlay" ? 0 : lines.length * lineHeight + padding * 1.6;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = photoHeight + band;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, format === "top" ? band : 0, width, photoHeight);

    ctx.font = `${fontSize}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, fontSize * 0.16);
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#fff";

    const startY =
        format === "top" ? padding * 0.8 : format === "bottom" ? photoHeight + padding * 0.8 : padding * 0.8;
    lines.forEach((line, i) => {
        const y = startY + i * lineHeight;
        ctx.strokeText(line, width / 2, y);
        ctx.fillText(line, width / 2, y);
    });

    // A tiny watermark in the corner, for provenance and pettiness.
    ctx.font = `${Math.max(12, Math.round(width * 0.018))}px ui-monospace, monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("LAUGH OR LAUGH", width - padding * 0.5, canvas.height - padding * 0.4);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Couldn't build the image.");
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
}
