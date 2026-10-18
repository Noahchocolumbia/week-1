import type { MemeFormat } from "@/lib/styles";

// A meme in one of three layouts: caption bar above ("top"), classic text on the photo
// ("overlay"), or caption bar below ("bottom").
export default function MemeImage({
    url,
    caption,
    format,
    size = "medium",
    eager = false,
}: {
    url: string;
    caption: string;
    format: MemeFormat;
    size?: "small" | "medium" | "large";
    eager?: boolean;
}) {
    const text = <p className="meme-text">{caption}</p>;
    return (
        <div className={`meme meme-${format} meme-${size}`}>
            {format === "top" && text}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Photo for the caption: ${caption}`} loading={eager ? "eager" : "lazy"} />
            {format !== "top" && text}
        </div>
    );
}
