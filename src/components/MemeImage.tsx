import Image from "next/image";
import type { MemeFormat } from "@/lib/styles";

// How wide each size is on screen, so Next.js serves a copy that's just big enough.
const SIZES = {
    small: "(max-width: 760px) 90vw, 420px",
    medium: "(max-width: 760px) 100vw, 640px",
    large: "(max-width: 760px) 100vw, 900px",
};

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
    // Local previews (blob: URLs in the studio) can't go through the resizer.
    const local = !url.startsWith("http");
    return (
        <div className={`meme meme-${format} meme-${size}`}>
            {format === "top" && text}
            <Image
                src={url}
                alt={`Photo for the caption: ${caption}`}
                width={1200}
                height={900}
                sizes={SIZES[size]}
                loading={eager ? "eager" : "lazy"}
                unoptimized={local}
            />
            {format !== "top" && text}
        </div>
    );
}
