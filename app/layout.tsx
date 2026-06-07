import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Caption Translation Workbench",
  description:
    "Realtime subtitle translation workbench with mock, microphone, and browser tab audio input modes."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
