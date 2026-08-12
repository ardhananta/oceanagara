import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Oceanagara - Cerdas Memantau, Aman Berlayar, Mutu Terjaga",
  description: "Platform Oceanagara untuk pemantauan cerdas, pelayaran aman, dan mutu tangkapan terjaga bagi nelayan Indonesia.",
  icons: {
    icon: [
      { url: "/icon.png?v=5", type: "image/png" },
      { url: "/icon.svg?v=5", type: "image/svg+xml" },
    ],
    shortcut: "/icon.png?v=5",
    apple: "/icon.png?v=5",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-white text-zinc-900">{children}</body>
    </html>
  );
}
