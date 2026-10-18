import type { Metadata } from "next";
import { Anton, Archivo, Geist, Geist_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// System labels and humorous status messages.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headlines. The width axis lets the same family go ultra-wide or condensed.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// The heavy, condensed typeface classic memes use. Only for the memes.
const meme = Anton({
  variable: "--font-meme",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Laugh or Laugh",
  description: "State-of-the-art artificial intelligence dedicated to the advancement of absolute nonsense.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${meme.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
