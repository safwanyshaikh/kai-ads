import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KAI Ads — Recruitment Advertisements in 60 Seconds",
    template: "%s · KAI Ads",
  },
  description:
    "KAI Ads enables licensed recruitment agencies to create professional overseas recruitment advertisements in less than 60 seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
