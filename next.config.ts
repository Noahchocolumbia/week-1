import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Meme photos live in Supabase storage. Letting Next.js resize them means the
  // browser downloads a small copy sized for the screen, not the original upload.
  images: {
    remotePatterns: [new URL("https://dgoeffuisrvsvnezptso.supabase.co/storage/v1/object/public/**")],
  },
};

export default nextConfig;
