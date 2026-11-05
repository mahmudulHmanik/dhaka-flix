import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DhakaFlix — BDIX streaming library",
  description: "A direct-play media library for DhakaFlix BDIX sources."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
