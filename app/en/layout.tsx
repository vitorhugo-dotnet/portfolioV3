import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../style.css";

export const metadata: Metadata = {
  title: "Hugo — Between code and chaos",
  description:
    "Vitor Hugo. Full-stack developer: Java, Spring, C#, .NET. Products, Android apps, and experiments.",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
  robots: { index: true, follow: true },
  openGraph: { locale: "en_US" },
};

export default function EnglishRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
