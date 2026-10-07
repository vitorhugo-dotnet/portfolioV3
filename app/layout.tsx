import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./style.css";

export const metadata: Metadata = {
  title: "Hugo — Entre código e caos",
  description:
    "Vitor Hugo. Full-stack developer: Java, Spring, C#, .NET. Produtos, apps Android e experimentos.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
