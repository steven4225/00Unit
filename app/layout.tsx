import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Caption Translation Workbench",
  description: "Phase-1 caption translation workbench shell."
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
