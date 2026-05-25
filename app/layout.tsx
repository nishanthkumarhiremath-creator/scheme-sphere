import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchemeSphere",
  description:
    "AI-powered Indian government and private scheme finder platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>{children}</body>
    </html>
  );
}
