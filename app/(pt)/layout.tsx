import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../style.css";
import {
  createPageMetadata,
  siteDescription,
  siteTitle,
} from "../../lib/site-config";

export const metadata: Metadata = {
  ...createPageMetadata(siteTitle, siteDescription),
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
