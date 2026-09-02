import type { Metadata } from "next";
import { Manrope, Noto_Sans_Ethiopic } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const notoEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic",
  subsets: ["ethiopic"],
});

export const metadata: Metadata = {
  title: "Muna Office — Smart work for Ethiopian teams",
  description: "A bilingual personal office assistant for Ethiopian companies.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${notoEthiopic.variable}`}>{children}</body>
    </html>
  );
}
