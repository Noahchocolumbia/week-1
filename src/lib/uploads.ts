// Upload limits shared by the client pre-checks and the server validation,
// so the browser and the server never disagree about what's allowed.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Accepted photo types for memes, mapped to their file extension.
export const PHOTO_TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

// Just the MIME types, for membership checks.
export const PHOTO_MIME_TYPES = Object.keys(PHOTO_TYPES);
