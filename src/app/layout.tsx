import type { Metadata } from "next";
import { DM_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", preload: false, display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", preload: false, display: "swap" });

export const metadata: Metadata = {
  title: "DhakaFlix — BDIX streaming library",
  description: "A direct-play media library for DhakaFlix BDIX sources."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className={`${manrope.variable} ${dmMono.variable}`}>{children}</body></html>;
}
